import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { UserService } from 'src/system/user/user.service';
import { UserResponseDto } from 'src/system/user/dto/user-response.dto';
import { LoginLogService } from 'src/system/logs/services/login-log.service';
import { SessionService } from 'src/system/session/session.service';
import { RolePermissionsService } from 'src/system/role/role-permission.service';
import path from 'path';
import { CryptoService } from 'src/common/services/crypto.service';
import { User } from 'src/core/entities/tb_user.entity';
import { PasswordStatus } from 'src/common/constants/password-status';
import { ConfigService } from '@nestjs/config';

const ALLOW_MULTI_SESSION = process.env.ALLOW_MULTI_SESSION === 'true';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(this.constructor.name);
  private readonly accessExp = Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 600); // 60s
  private readonly refreshExp = Number(
    process.env.JWT_REFRESH_EXPIRES_IN ?? 3600,
  ); // 1800s
  private readonly superAdmins = String(process.env.SUPER_ADMIN_IDS).split(',');

  constructor(
    private readonly userService: UserService,
    private readonly loginLogService: LoginLogService,
    private readonly jwt: JwtService,
    private readonly sessionService: SessionService,
    private readonly rolePermissionsService: RolePermissionsService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {
    const configPath = path.resolve(process.cwd(), 'config/super-admins.json');
  }

  private calculatePasswordStatus(user: any): PasswordStatus {
    const isPolicyEnabled = this.configService.get<boolean>(
      'security.isChangeCyclePolicyEnabled',
    );
    if (!isPolicyEnabled || this.superAdmins.includes(user.loginId)) {
      return PasswordStatus.OK;
    }

    const cycleDays = this.configService.get<number>(
      'security.changeCycleDays',
    ) as number;
    const passwordChangedAt = user.passwordChangedAt;

    if (!passwordChangedAt) {
      return PasswordStatus.MUST_CHANGE;
    }

    const expirationDate = new Date(passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + cycleDays);

    if (new Date() > expirationDate) {
      return PasswordStatus.EXPIRED;
    }

    return PasswordStatus.OK;
  }

  /**
   * 사용자 검증로직
   * 로그인 처리
   * @param loginId
   * @param encryptedPwd
   * @param ip
   * @param agent
   * @returns
   */
  async validateUser(
    loginId: string,
    encryptedPwd: string,
    ip?: string,
    agent?: string,
  ): Promise<User> {
    const user = await this.userService.findByLoginIdForAuth(loginId);
    // 사용자가 없을 때
    if (!user) {
      await this.loginLogService.record(undefined, loginId, {
        result: 'FAIL',
        ip,
        userAgent: agent,
        message: '존재하지 않는 로그인 ID',
      });
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 활성상태가 아닐때
    if (!user || !user.isActive) {
      await this.loginLogService.record(user?.userId as number, loginId, {
        result: 'FAIL',
        ip,
        userAgent: agent,
        message: '비활성 사용자 접근',
      });
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    const plain = await this.cryptoService.decryptPassword(encryptedPwd);
    const isMatch = await bcrypt.compare(plain, user.password);

    if (!isMatch) {
      // 실패 누적 + 잠금(비활성) 전환은 운영정책에 따라 user.service에 메서드가 있으면 호출
      await this.userService.increaseFailCountAndMaybeDeactivate(user.userId);
      await this.loginLogService.record(user.userId, user.loginId, {
        result: 'FAIL',
        ip,
        userAgent: agent,
        message: '비밀번호 불일치',
      });
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 성공 처리
    await this.userService.updateLastLogin(user.userId, ip, agent);
    return user;
  }

  /**
   * 토큰 발급
   * @param user
   * @param session
   * @param oldRefreshToken
   * @returns
   */
  private async signTokens(user: any, session?, oldRefreshToken?: string) {
    const isInitLogin = !session;
    const sessionId = isInitLogin ? randomUUID() : session.sessionId;

    //권한 ID 가져오기
    const roleInfo = await this.userService.getAllRoleInfo(user.userId);
    const roleIds = roleInfo.map((r) => r.roleId);
    const isSuperAdmin = this.superAdmins.some(
      (loginId) => loginId === user.loginId,
    );
    const payload = {
      sub: user.userId,
      loginId: user.loginId,
      userNm: user.userNm,
      roles: roleInfo,
      roleIds,
      isSuperAdmin,
      sessionId,
      email: user.email,
      cellphnoe: user.cellphnoe,
    };
    // accessToken 계속 재발급
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: `${this.accessExp}s`,
    });

    // 최초 로그인 이거나, 만료시간이 30분 미만일 경우
    let refreshToken = '';
    const remain = isInitLogin
      ? 0
      : Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);

    if (isInitLogin || remain < 1800) {
      refreshToken = await this.jwt.signAsync(payload, {
        expiresIn: `${this.refreshExp}s`,
      });
    } else {
      refreshToken = oldRefreshToken as string;
    }

    const expiresAt = new Date(Date.now() + this.refreshExp * 1000);

    return { accessToken, refreshToken, sessionId, expiresAt };
  }

  /**
   *  로그인
   * @param loginId
   * @param encryptedPwd
   * @param ip
   * @param agent
   * @returns
   */
  async login(
    loginId: string,
    encryptedPwd: string,
    ip?: string,
    agent?: string,
  ) {
    const user = await this.validateUser(loginId, encryptedPwd, ip, agent);
    const { accessToken, refreshToken, sessionId, expiresAt } =
      await this.signTokens(user);
    // 단일 세션 모드일 경우 기존 세션 비활성화
    if (!ALLOW_MULTI_SESSION)
      await this.sessionService.deactivateAllByUser(user.userId);
    // session 생성
    await this.sessionService.createSession(
      user.userId,
      sessionId,
      expiresAt,
      ip,
      agent,
    );
    const isSuperAdmin = this.superAdmins.some(
      (loginId) => loginId === user.loginId,
    );

    let authorizedMenu: any = [];

    if (!isSuperAdmin) {
      authorizedMenu =
        await this.rolePermissionsService.getAuthorizedMenuForUser(user.userId);
    } else {
      authorizedMenu =
        await this.rolePermissionsService.getAllMenusWithAllActions();
    }

    const passwordStatus = this.calculatePasswordStatus(user);

    // access 기록 및 최근 로그인 정보 업데이트
    await this.loginLogService.record(user.userId, user.loginId, {
      result: 'LOGIN',
      ip,
      userAgent: agent,
      message: '로그인 성공',
      sessionId,
    });
    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        loginId: user.loginId,
        userNm: user.userNm,
        isSuperAdmin,
        email: user.email,
        cellPhone: user.cellPhone,
        passwordStatus,
      },
      authorizedMenu,
    };
  }

  /**
   * 토큰 재발급
   * @param beforeRefreshToken 이전 refresh토큰
   * @returns
   */
  async refreshByToken(beforeRefreshToken: string) {
    const secret = process.env.JWT_SECRET;
    try {
      if (!secret)
        throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
      // 만료·위조 검사
      const payload = await this.jwt.verifyAsync(beforeRefreshToken, {
        ignoreExpiration: false,
      });
      const user = await this.userService.findOneById(payload.sub);
      if (!user || !user.isActive)
        throw new UnauthorizedException('비활성 사용자입니다.');

      // 세션 만료 여부 검사
      const session = await this.sessionService.findBySessionId(
        payload.sessionId,
      );
      if (!session || !session.isActive) {
        throw new UnauthorizedException('세션이 만료되었습니다.');
      }
      if (session.expiresAt.getTime() < Date.now()) {
        this.sessionService.deactivateSession(session.sessionId);
        throw new UnauthorizedException('세션이 만료되었습니다.');
      }

      const { accessToken, refreshToken, sessionId, expiresAt } =
        await this.signTokens(user, session, beforeRefreshToken);
      // refresh 토큰 갱신시 업데이트
      if (beforeRefreshToken !== refreshToken) {
        await this.sessionService.updateRefreshExp(sessionId, expiresAt);
      }

      return { accessToken, refreshToken };
    } catch {
      this.logger.debug(`===> Refresh Token 검증 실패`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * 로그아웃
   * @param refreshToken
   * @param ip
   * @param agent
   * @returns
   */
  async logout(refreshToken: string, ip?: string, agent?: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');

    try {
      const payload = await this.jwt.verifyAsync<any>(refreshToken, {});

      await this.sessionService.deactivateSession(payload.sessionId);
      await this.loginLogService.updateLogoutBySessionId(
        payload.sub,
        payload.sessionId,
        '정상 로그아웃',
      );
    } catch {
      /* ignore */
    }
    return { success: true };
  }

  /**
   * RSA 공개키 가져오기
   * @returns
   */
  async getPublicKey(): Promise<string> {
    return this.cryptoService.getPublicKey();
  }

  /**
   * 세션 정보 조회 로직 (login 메소드와 유사)
   */
  async getSessionInfo(userId: number) {
    // 1. 사용자 정보 조회 (login과 달리 비밀번호 검증 불필요)
    //    UserService에 DTO 반환하는 findOneById 사용 또는 직접 조회
    const userDto = await this.userService.findOneById(userId); // UserResponseDto 반환 가정
    if (!userDto) {
      throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다.');
    }
    // isSuperAdmin 정보 필요 시 User 엔티티 조회 또는 UserResponseDto에 추가 필요
    const isSuperAdmin = this.superAdmins.some(
      (loginId) => loginId === userDto.loginId, // UserResponseDto에 loginId가 있다고 가정
    );

    // 2. 권한 메뉴 조회 (login 메소드와 동일)
    let authorizedMenu: any = [];
    if (isSuperAdmin) {
      authorizedMenu =
        await this.rolePermissionsService.getAllMenusWithAllActions();
    } else {
      authorizedMenu =
        await this.rolePermissionsService.getAuthorizedMenuForUser(userId);
    }

    // 3. 필요한 정보 조합하여 반환 (login 응답과 유사하게)
    return {
      // UserResponseDto를 그대로 사용하거나 필요한 필드만 추출
      user: {
        userId: userDto.userId,
        loginId: userDto.loginId,
        userNm: userDto.userNm,
        isSuperAdmin, // isSuperAdmin 정보 포함
      },
      authorizedMenu,
    };
  }
}
