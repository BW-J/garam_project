import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/tb_audit_log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * 감사 로그 저장
   * @param entityNm 테이블명
   * @param entityKey PK 값
   * @param operation INSERT / UPDATE / DELETE
   * @param changedBy 사용자 ID
   * @param changes 변경된 필드 (diffObjects 결과)
   */
  async record(
    entityNm: string,
    entityKey: string | null,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    changedBy: number,
    changes: Record<string, { old: any; new: any }> | null,
  ) {
    const log = this.auditRepo.create({
      entityNm,
      entityKey: entityKey ?? undefined,
      operation,
      changedBy,
      changes,
    });

    await this.auditRepo.save(log);
  }

  /**
   * 사용자 이름 포함 감사 로그 조회 (JOIN)
   */
  async findAllWithUser(): Promise<any[]> {
    return await this.auditRepo
      .createQueryBuilder('a')
      .leftJoin('a.changedByUser', 'u')
      .select([
        'a.auditId AS auditId',
        'a.entityNm AS entityNm',
        'a.entityKey AS entityKey',
        'a.operation AS operation',
        'a.oldVal AS oldVal',
        'a.newVal AS newVal',
        'a.createdAt AS createdAt',
        'u.userId AS changedBy',
        'u.userNm AS changedByName',
      ])
      .orderBy('a.createdAt', 'DESC')
      .limit(100)
      .getRawMany();
  }

  /**
   * 조회 (최근 순)
   */
  async findAll(limit = 100) {
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['changedByUser'],
    });
  }
}
