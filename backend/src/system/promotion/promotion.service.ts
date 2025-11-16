import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThan } from 'typeorm';
import { User } from 'src/core/entities/tb_user.entity';
import { PerformanceData } from 'src/core/entities/tb_performance_data.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { Position } from 'src/core/entities/tb_position.entity';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import { UserService } from '../user/user.service';
import dayjs from 'dayjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { getEffectiveStartDate } from 'src/common/utils/business-date.util';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PerformanceData)
    private perfRepo: Repository<PerformanceData>,
    @InjectRepository(UserClosure) private closureRepo: Repository<UserClosure>,
    @InjectRepository(Position) private posRepo: Repository<Position>,
    @InjectRepository(UserPositionHistory)
    private historyRepo: Repository<UserPositionHistory>,
    private userService: UserService, // 직급 변경 실행용
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPositionId(
    positionCd: 'DESIGNER' | 'MANAGER' | 'DIRECTOR',
  ): Promise<number> {
    const cacheKey = `pos_id:${positionCd}`;

    // 1. 캐시에서 먼저 조회
    const cachedId = await this.cacheManager.get<number>(cacheKey);
    if (cachedId) {
      return cachedId;
    }

    // 2. 캐시가 없으면 DB 조회
    this.logger.log(
      `Cache miss for position ID: ${positionCd}. Querying DB...`,
    );
    const position = await this.posRepo.findOneBy({ positionCd });

    if (!position) {
      this.logger.error(
        `CRITICAL: Position code '${positionCd}' not found in DB.`,
      );
      throw new Error(
        `필수 직급 코드(${positionCd})를 DB에서 찾을 수 없습니다.`,
      );
    }

    // 3. 캐시에 24시간(86400000ms) 저장 (0으로 설정 시 무한)
    await this.cacheManager.set(cacheKey, position.positionId, 86400000);

    return position.positionId;
  }

  /**
   * 승진 실행 (Controller가 호출)
   */
  async promoteUser(userId: number, adminUserId: number) {
    const user = await this.userRepo.findOneBy({ userId });
    if (!user) throw new NotFoundException('User not found');

    let newPositionId: number | null = null;
    let eligibilityCheck;
    let targetPositionType: 'MANAGER' | 'DIRECTOR';

    // 1. 승진할 다음 직급 결정
    const designerPosId = await this.getPositionId('DESIGNER');
    const managerPosId = await this.getPositionId('MANAGER');
    const directorPosId = await this.getPositionId('DIRECTOR');

    if (user.positionId === designerPosId) {
      newPositionId = managerPosId;
      targetPositionType = 'MANAGER';
      eligibilityCheck = await this.checkManagerEligibility(user);
    } else if (user.positionId === managerPosId) {
      newPositionId = directorPosId;
      targetPositionType = 'DIRECTOR';
      eligibilityCheck = await this.checkDirectorEligibility(user);
    } else {
      throw new BadRequestException(
        '이미 최고 직급이거나 승진 대상이 아닙니다.',
      );
    }

    // 2. 자격 검사
    if (!eligibilityCheck.isEligible) {
      throw new BadRequestException({
        message: '승진 요건을 충족하지 못했습니다.',
        unmetConditions: eligibilityCheck.unmetConditions,
      });
    }

    // 3. UserService의 전용 메서드를 호출하여 승진 실행
    const updatedUser = await this.userService.promoteUserPosition(
      userId,
      newPositionId,
      adminUserId,
    );

    return {
      success: true,
      message: `${user.userNm}님이 ${targetPositionType}으로 승진 처리되었습니다.`,
      user: updatedUser,
    };
  }

  /**
   * 일괄 승진
   * @param userIds
   * @param adminUserId
   * @returns
   */
  async promoteBatch(userIds: number[], adminUserId: number) {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.promoteUser(userId, adminUserId)),
    );

    let successCount = 0;
    const failedCases: { userId: number; reason: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        // 'promoteUser'에서 던진 BadRequestException 또는 NotFoundException
        failedCases.push({
          userId: userIds[index],
          reason: result.reason?.message || '알 수 없는 오류',
        });
      }
    });

    return {
      totalRequested: userIds.length,
      successCount,
      failedCount: failedCases.length,
      failedCases, // 프론트엔드에서 실패 사유를 보여줄 수 있도록
    };
  }

  /**
   * 승진 대상자 목록 조회 (Controller가 호출)
   */
  async getPromotionCandidates(targetPosition: 'MANAGER' | 'DIRECTOR') {
    let sourcePositionId: number;
    let checkFunction: (user: User) => Promise<any>;

    if (targetPosition === 'MANAGER') {
      sourcePositionId = await this.getPositionId('DESIGNER');
      checkFunction = this.checkManagerEligibility.bind(this);
    } else if (targetPosition === 'DIRECTOR') {
      sourcePositionId = await this.getPositionId('MANAGER');
      checkFunction = this.checkDirectorEligibility.bind(this);
    } else {
      throw new BadRequestException('Invalid target position');
    }

    const users = await this.userRepo.find({
      where: { positionId: sourcePositionId, isActive: true },
      relations: ['position'],
    });

    const results = await Promise.all(
      users.map(async (user) => {
        const eligibility = await checkFunction(user);
        return {
          user: {
            userId: user.userId,
            userNm: user.userNm,
            loginId: user.loginId,
            position: user.position,
            createdAt: user.createdAt,
          },
          ...eligibility,
        };
      }),
    );

    // 전체 반환 (프론트에서 필터링: 충족 / 미충족)
    return results;
  }

  // --- 1. 본부장 승진 조건 검사 ---
  private async checkManagerEligibility(user: User) {
    const unmetConditions: string[] = [];
    const checkDate = dayjs(); // 오늘 날짜 기준
    let falseCount = 0;

    const effectiveStartDate = getEffectiveStartDate(user.createdAt);
    // 7개월이 지난 시점 (즉, 8개월차 1일)
    const eligibleDate = dayjs(effectiveStartDate).add(7, 'month');

    // 오늘 날짜가 8개월차 1일보다 이전이면 (즉, 7개월 미경과)
    if (eligibleDate.isAfter(checkDate)) {
      unmetConditions.push(
        `입사 7개월 미만  ${eligibleDate.format('YYYY-MM')} 부터 승진 가능`,
      );
      falseCount++;
    } else {
      unmetConditions.push(
        `입사 7개월 이상 : ${eligibleDate.format('YYYY-MM')} 부터 승진 가능`,
      );
    }

    // 조건 2: 개인 누적 실적 600만
    const personalPerf = await this.getPersonalCumulativePerformance(
      user.userId,
    );
    if (personalPerf < 6000000) {
      unmetConditions.push(
        `개인 누적 실적 부족 (현재 ${personalPerf.toLocaleString('ko-KR')}원)`,
      );
      falseCount++;
    } else {
      unmetConditions.push(
        `개인 누적 실적 충족 (현재 ${personalPerf.toLocaleString('ko-KR')}원)`,
      );
    }

    // 조건 3: IQA 80% 이상 (전체 기간 평균)
    const avgIQA = await this.getAverageIQA(user.userId);
    if (avgIQA < 80) {
      unmetConditions.push(`IQA 유지율 80% 미만 (현재 ${avgIQA}%)`);
      falseCount++;
    } else {
      unmetConditions.push(`IQA 유지율 80% 충족 (현재 ${avgIQA}%)`);
    }

    // 조건 4: 직계 추천 2명
    const directRecruits = await this.getDirectRecruitCount(user.userId);
    if (directRecruits < 2) {
      unmetConditions.push(`직계 추천인 2명 미만 (현재 ${directRecruits}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`직계 추천인 2명 이상 (현재 ${directRecruits}명)`);
    }

    // 조건 5: 산하 10명 (1~10 depth)
    const downlineCount = await this.getDownlineCount(user.userId);
    if (downlineCount < 10) {
      unmetConditions.push(`산하 10명 미만 (현재 ${downlineCount}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`산하 10명 이상 (현재 ${downlineCount}명)`);
    }

    // 조건 6: 직전 3개월 산하 실적 1000만 (1~10 depth)
    const downlinePerf3M = await this.getDownlinePerformance(user.userId, 3);
    if (downlinePerf3M < 10000000) {
      unmetConditions.push(
        `직전 3개월 산하 실적 부족 (현재 ${downlinePerf3M.toLocaleString('ko-KR')}원)`,
      );
      falseCount++;
    } else {
      unmetConditions.push(
        `직전 3개월 산하 실적 충족 (현재 ${downlinePerf3M.toLocaleString('ko-KR')}원)`,
      );
    }

    return {
      isEligible: falseCount === 0,
      unmetConditions,
    };
  }

  // --- 2. 지사장 승진 조건 검사 ---
  private async checkDirectorEligibility(user: User) {
    const unmetConditions: string[] = [];
    const checkDate = dayjs();
    let falseCount = 0;

    // 조건 1: 본부장 승진 7개월 경과
    const managerPosId = await this.getPositionId('MANAGER');
    const managerPromotionDate = await this.getLatestPositionChangeDate(
      user.userId,
      managerPosId,
    );

    if (!managerPromotionDate) {
      unmetConditions.push('본부장 승진 이력 없음');
    } else {
      // 승진일(예: 3/15)을 기준으로 '유효 시작월'(예: 4/1)을 계산
      const effectivePromotionStartDate =
        getEffectiveStartDate(managerPromotionDate);
      // 7개월이 지난 시점 (8개월차 1일)
      const eligibleDate = dayjs(effectivePromotionStartDate).add(7, 'month');

      if (eligibleDate.isAfter(checkDate)) {
        unmetConditions.push(
          `본부장 승진 7개월 미만  ${eligibleDate.format('YYYY-MM')} 부터 승진 가능`,
        );
        falseCount++;
      } else {
        unmetConditions.push(
          `본부장 승진 7개월 이상  ${eligibleDate.format('YYYY-MM')} 부터 승진 가능`,
        );
      }
    }

    // 조건 2: IQA 80% 이상
    const avgIQA = await this.getAverageIQA(user.userId);
    if (avgIQA < 80) {
      unmetConditions.push(`IQA 유지율 80% 미만 (현재 ${avgIQA}%)`);
      falseCount++;
    } else {
      unmetConditions.push(`IQA 유지율 80% 충족 (현재 ${avgIQA}%)`);
    }

    // 조건 3: 산하 30명
    const downlineCount = await this.getDownlineCount(user.userId);
    if (downlineCount < 30) {
      unmetConditions.push(`산하 30명 미만 (현재 ${downlineCount}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`산하 30명 이상 (현재 ${downlineCount}명)`);
    }

    // 조건 4: 직전 3개월 산하 실적 3000만
    const downlinePerf3M = await this.getDownlinePerformance(user.userId, 3);
    if (downlinePerf3M < 30000000) {
      unmetConditions.push(
        `직전 3개월 산하 실적 부족 (현재 ${downlinePerf3M.toLocaleString('ko-KR')}원)`,
      );
      falseCount++;
    } else {
      unmetConditions.push(
        `직전 3개월 산하 실적 충족 (현재 ${downlinePerf3M.toLocaleString('ko-KR')}원)`,
      );
    }

    return {
      isEligible: falseCount === 0,
      unmetConditions,
    };
  }

  // --- 헬퍼 메서드 (조건 검사용) ---

  private async getPersonalCumulativePerformance(
    userId: number,
  ): Promise<number> {
    const currentMonth = dayjs().format('YYYY-MM');
    const result = await this.perfRepo.sum('insurancePremium', {
      userId,
      yearMonth: LessThan(currentMonth),
    });
    return result || 0;
  }

  private async getAverageIQA(
    userId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const currentMonth = dayjs().format('YYYY-MM');
    // IQA 유지율도 평균값이야 전체 기간에 대해서 봐야 할 것 같아
    // 혹시라도 기간이 들어 갈 수있으니 그 부분 수정할 수 있게 미리 설계 같이 해줘
    const qb = this.perfRepo
      .createQueryBuilder('perf')
      .select('AVG(perf.iqaMaintenanceRate)', 'avgIQA')
      .where('perf.userId = :userId', { userId })
      .andWhere('perf.yearMonth < :currentMonth', { currentMonth });

    if (startDate)
      qb.andWhere('perf.yearMonth >= :startDate', {
        startDate: dayjs(startDate).format('YYYY-MM'),
      });
    if (endDate)
      qb.andWhere('perf.yearMonth <= :endDate', {
        endDate: dayjs(endDate).format('YYYY-MM'),
      });

    const result = await qb.getRawOne();
    return Number(result?.avgIQA || 0);
  }

  private async getDirectRecruitCount(userId: number): Promise<number> {
    return this.userRepo.count({
      where: { recommenderId: userId, isActive: true },
    });
  }

  private async getDownlineCount(ancestorId: number): Promise<number> {
    // 1~10 depth
    return this.closureRepo.count({
      where: { ancestorId, depth: Between(1, 10) },
    });
  }

  private async getDownlinePerformance(
    ancestorId: number,
    months: number,
  ): Promise<number> {
    // 1. 산하 10단계 유저 ID 목록 조회
    const downlines = await this.closureRepo.find({
      where: { ancestorId, depth: Between(1, 10) },
      select: ['descendantId'],
    });
    const downlineIds = downlines.map((d) => d.descendantId);
    if (downlineIds.length === 0) return 0;

    // 2. 직전 3개월 기간 계산
    const checkDate = dayjs();
    const endMonth = checkDate.subtract(1, 'month').format('YYYY-MM'); // 이번 달 제외
    const startMonth = checkDate.subtract(months, 'month').format('YYYY-MM');

    // 3. 해당 기간 실적 합산
    const result = await this.perfRepo.sum('insurancePremium', {
      userId: In(downlineIds),
      yearMonth: Between(startMonth, endMonth),
    });
    return result || 0;
  }

  private async getLatestPositionChangeDate(
    userId: number,
    positionId: number,
  ): Promise<Date | null> {
    const history = await this.historyRepo.findOne({
      where: { userId: userId, newPositionId: positionId },
      order: { changedAt: 'DESC' },
    });
    return history?.changedAt || null;
  }
}
