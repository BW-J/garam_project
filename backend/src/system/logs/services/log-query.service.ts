import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from 'src/system/logs/entities/tb_audit_log.entity';
import { UserActivityLog } from 'src/system/logs/entities/tb_user_activity_log.entity';
import { SearchLogDto } from '../dto/search-log.dto';

@Injectable()
export class LogQueryService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(UserActivityLog)
    private readonly activityRepo: Repository<UserActivityLog>,
  ) {}

  /**
   * 감사 로그 단독 조회
   */
  async findAuditLogs(filters: SearchLogDto) {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.changedByUser', 'u');

    if (filters.userId)
      qb.andWhere('a.changedBy = :userId', { userId: filters.userId });
    if (filters.entityNm)
      qb.andWhere('a.entityNm = :entityNm', { entityNm: filters.entityNm });
    if (filters.operation)
      qb.andWhere('a.operation = :operation', { operation: filters.operation });
    if (filters.startDate)
      qb.andWhere('a.createdAt >= :start', { start: filters.startDate });
    if (filters.endDate)
      qb.andWhere('a.createdAt <= :end', {
        end: `${filters.endDate} 23:59:59`,
      });

    qb.orderBy('a.createdAt', 'DESC');

    return qb.getMany();
  }

  /**
   * 사용자 행위 로그 단독 조회
   */
  async findActivityLogs(filters: SearchLogDto) {
    const qb = this.activityRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u');

    if (filters.userId)
      qb.andWhere('l.userId = :userId', { userId: filters.userId });
    if (filters.keyword)
      qb.andWhere(
        '(l.actionName ILIKE :kw OR l.path ILIKE :kw OR CAST(l.resultStatus AS TEXT) ILIKE :kw)',
        { kw: `%${filters.keyword}%` },
      );
    if (filters.startDate)
      qb.andWhere('l.createdAt >= :start', { start: filters.startDate });
    if (filters.endDate)
      qb.andWhere('l.createdAt <= :end', {
        end: `${filters.endDate} 23:59:59`,
      });

    qb.orderBy('l.createdAt', 'DESC');

    return qb.getMany();
  }

  /**
   * 두 로그 통합 조회 (시간 순 정렬)
   */
  async findUnifiedLogs(filters: SearchLogDto) {
    const [auditLogs, activityLogs] = await Promise.all([
      this.findAuditLogs(filters),
      this.findActivityLogs(filters),
    ]);

    const unified = [
      ...auditLogs.map((a) => ({
        type: 'AUDIT',
        userId: a.changedBy,
        userName: a.changedByUser?.userNm,
        entity: a.entityNm,
        operation: a.operation,
        detail: a.changes,
        timestamp: a.createdAt,
      })),
      ...activityLogs.map((l) => ({
        type: 'ACTIVITY',
        userId: l.userId,
        userName: l.user?.userNm,
        actionName: l.actionName,
        path: l.path,
        method: l.method,
        status: l.resultStatus,
        timestamp: l.createdAt,
      })),
    ];

    // 최신순 정렬
    unified.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return unified;
  }
}
