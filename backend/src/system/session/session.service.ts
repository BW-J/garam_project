import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserSession } from './tb_user_session.entity';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepo: Repository<UserSession>,
  ) {}

  async createSession(
    userId: number,
    sessionId: string,
    expiresAt: Date,
    ipAddr?: string,
    userAgent?: string,
  ) {
    const session = this.sessionRepo.create({
      userId,
      sessionId,
      expiresAt,
      ipAddr,
      userAgent,
    });
    return await this.sessionRepo.save(session);
  }

  async findBySessionId(sessionId: string) {
    return await this.sessionRepo.findOne({ where: { sessionId } });
  }

  async updateRefreshExp(sessionId: string, newExp: Date) {
    await this.sessionRepo.update(
      { sessionId },
      { expiresAt: newExp, updatedAt: new Date() },
    );
  }

  async deactivateSession(sessionId: string) {
    await this.sessionRepo.update({ sessionId }, { isActive: false });
  }

  async deactivateExpired() {
    const now = new Date();
    await this.sessionRepo.update(
      { expiresAt: LessThan(now), isActive: true },
      { isActive: false },
    );
  }

  async deactivateAllByUser(userId: number) {
    await this.sessionRepo.update(
      { userId, isActive: true },
      { isActive: false },
    );
  }

  async isActive(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    return !!(session && session.isActive && session.expiresAt > new Date());
  }
}
