import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivityLog } from '../entities/tb_user_activity_log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityRepo: Repository<UserActivityLog>,
  ) {}

  /**
   * 사용자 액션 로그 기록
   * @param user 사용자 엔티티
   * @param actionName 액션명
   * @param method HTTP 메서드
   * @param path 요청 경로
   * @param ipAddr IP 주소
   * @param userAgent 사용자 에이전트
   * @param params 요청 파라미터
   * @param resultStatus 응답 상태 코드
   */
  async record(log: Partial<UserActivityLog>): Promise<void> {
    const entity = this.activityRepo.create(log);

    await this.activityRepo.save(entity);
  }

  /**
   * 사용자 이름 포함 조회 (간단 버전)
   */
  async findAll(): Promise<UserActivityLog[]> {
    return this.activityRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findRecentByUser(userId: number, limit = 50) {
    return this.activityRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 사용자 이름 포함 조회 (플랫 + 선택 컬럼)
   */
  async findAllFlat(): Promise<any[]> {
    return this.activityRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .select([
        'a.activityId AS activityId',
        'a.actionName AS actionName',
        'a.method AS method',
        'a.path AS path',
        'a.ipAddr AS ipAddr',
        'a.userAgent AS userAgent',
        'a.params AS params',
        'a.resultStatus AS resultStatus',
        'a.createdAt AS createdAt',
        'u.userId AS userId',
        'u.userNm AS userNm',
      ])
      .orderBy('a.createdAt', 'DESC')
      .limit(100)
      .getRawMany();
  }
}
