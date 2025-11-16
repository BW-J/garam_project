import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginLog } from 'src/system/logs/entities/tb_login_log.entity';
import { Repository } from 'typeorm';

interface LoginLogOptions {
  result: 'LOGIN' | 'FAIL' | 'LOCKED' | 'LOGOUT';
  ip?: string;
  userAgent?: string;
  message?: string;
  sessionId?: string;
}

@Injectable()
export class LoginLogService {
  private readonly USE_LOGIN_LOG: boolean;

  constructor(
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
  ) {
    this.USE_LOGIN_LOG = process.env.USE_LOGIN_LOG === 'Y';
  }

  async record(userId, loginId: string, opt: LoginLogOptions) {
    if (this.USE_LOGIN_LOG) {
      const log = this.loginLogRepo.create({
        userId,
        loginId,
        loginTime: new Date(),
        ip: opt.ip,
        userAgent: opt.userAgent,
        result: opt.result,
        message: opt.message,
        sessionId: opt.sessionId,
      });
      await this.loginLogRepo.save(log);
    }
  }

  async updateLogoutBySessionId(
    userId: number,
    sessionId: string,
    message: string,
  ) {
    if (this.USE_LOGIN_LOG) {
      // 가장 최근 로그인 로그의 logout_time 갱신
      const log = await this.loginLogRepo.findOne({
        where: { userId, sessionId },
        order: { loginTime: 'DESC' },
      });
      if (log) {
        log.logoutTime = new Date();
        log.result = 'LOGOUT';
        log.message = message || '정상 로그아웃';
        await this.loginLogRepo.save(log);
      }
    }
  }
}
