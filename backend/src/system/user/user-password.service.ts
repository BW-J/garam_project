import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserPasswordHistory } from 'src/core/entities/tb_user_password_history';
import { CryptoService } from 'src/common/services/crypto.service';

@Injectable()
export class UserPasswordService {
  private readonly logger = new Logger(UserPasswordService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  async validateNewPassword(
    manager: EntityManager,
    userId: number | null,
    encryptedPassword: string,
  ): Promise<string> {
    // 4-1. 복호화
    const plainPassword =
      await this.cryptoService.decryptPassword(encryptedPassword);

    // 4-2. 복잡도 검사
    await this.validatePasswordPolicy(plainPassword);

    // 4-3. 재사용 검사
    if (userId !== null) {
      await this.validatePasswordReuse(manager, userId, plainPassword);
    }

    return plainPassword; // 💡 검증이 통과된 평문 반환
  }

  /**
   * 2. 비밀번호 복잡도 검사
   * @param password
   * @returns
   */
  private async validatePasswordPolicy(password: string) {
    // 복잡도 정책이 켜져있는지 확인
    if (
      !this.configService.get<boolean>('security.isComplexityPolicyEnabled')
    ) {
      return; // 켜져있지 않으면 통과
    }

    // .env에서 정규식 '문자열'과 '메시지'를 읽어옴
    const regexString = this.configService.get<string>(
      'security.passwordRegexString',
    );
    const message = this.configService.get<string>(
      'security.passwordRegexMessage',
    );

    if (!regexString) {
      this.logger.warn(
        '비밀번호 정규식(PASSWORD_COMPLEXITY_REGEX)이 .env에 설정되지 않았습니다.',
      );
      return; // 정규식이 없으면 통과 (안전 모드)
    }

    // 문자열로부터 정규식 객체(RegExp) 생성
    const regex = new RegExp(regexString);

    // 검사
    if (!regex.test(password)) {
      throw new BadRequestException(message);
    }
  }

  /**
   * 3. 비밀번호 재사용 검사
   * @param manager
   * @param plainPassword
   * @param userId
   * @returns
   */
  private async validatePasswordReuse(
    manager: EntityManager,
    userId: number,
    plainPassword: string,
  ): Promise<void> {
    if (!this.configService.get<boolean>('security.isReusePolicyEnabled')) {
      return;
    }
    const count = this.configService.get<number>(
      'security.reusePreventionCount',
    ) as number;
    if (count <= 0) return;

    const historyRepo = manager.getRepository(UserPasswordHistory);
    const recentHashes = await historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: count,
    });

    if (recentHashes.length === 0) return;

    for (const record of recentHashes) {
      const isMatch = await bcrypt.compare(plainPassword, record.passwordHash);
      if (isMatch) {
        throw new BadRequestException(
          `이전에 사용한 비밀번호와 다르게 설정해야 합니다.`,
        );
      }
    }
  }

  /**
   * 4. 비밀번호 히스토리 저장 및 정리
   */
  async savePasswordHistory(
    manager: EntityManager,
    userId: number,
    passwordHash: string,
  ): Promise<void> {
    const historyRepo = manager.getRepository(UserPasswordHistory);
    const newHistory = historyRepo.create({ userId, passwordHash });
    await historyRepo.save(newHistory);

    // (정리) N개 초과하는 가장 오래된 히스토리 삭제
    const count = this.configService.get<number>(
      'security.reusePreventionCount',
    ) as number;
    const allHistory = await historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['historyId'],
    });

    if (allHistory.length > count) {
      await historyRepo.remove(allHistory.slice(count));
    }
  }
}
