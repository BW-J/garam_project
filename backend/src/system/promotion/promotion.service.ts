import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThan, IsNull } from 'typeorm';
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
import { PositionCode } from 'src/common/constants/position-code.enum';

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

  async getPositionId(positionCd: PositionCode): Promise<number> {
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
    let targetPositionType: PositionCode;

    // 1. 승진할 다음 직급 결정
    const designerPosId = await this.getPositionId(PositionCode.SFP);
    const managerPosId = await this.getPositionId(PositionCode.MANAGER);
    const directorPosId = await this.getPositionId(PositionCode.DIRECTOR);

    // (promoteUser는 1명 대상이므로 N+1 문제가 없음. 기존 단일 조회 로직 유지)

    if (user.positionId === designerPosId) {
      newPositionId = managerPosId;
      targetPositionType = PositionCode.MANAGER;
      eligibilityCheck = await this.checkManagerEligibility(user);
    } else if (user.positionId === managerPosId) {
      newPositionId = directorPosId;
      targetPositionType = PositionCode.DIRECTOR;
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
    // 일괄 승진 시 N+1이 발생하므로, 자격 검사를 일괄 처리합니다.
    const users = await this.userRepo.find({
      where: { userId: In(userIds), isActive: true },
      relations: ['position'],
    });

    const eligibilityMap = await this.checkEligibilityBatch(users);

    const results = await Promise.allSettled(
      users.map(async (user) => {
        const eligibility = eligibilityMap.get(user.userId);

        if (!eligibility) {
          throw new BadRequestException('대상자 정보를 찾을 수 없습니다.');
        }

        if (!eligibility.isEligible) {
          throw new BadRequestException({
            message: '승진 요건을 충족하지 못했습니다.',
            unmetConditions: eligibility.unmetConditions,
          });
        }

        // newPositionId는 eligibilityCheck에서 이미 계산됨
        const newPositionId = eligibility.newPositionId;
        if (!newPositionId) {
          throw new BadRequestException(
            '이미 최고 직급이거나 대상이 아닙니다.',
          );
        }

        // 3. UserService의 전용 메서드를 호출하여 승진 실행
        return this.userService.promoteUserPosition(
          user.userId,
          newPositionId,
          adminUserId,
        );
      }),
    );

    // (기존 결과 처리 로직 동일)
    let successCount = 0;
    const failedCases: { userId: number; reason: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        // 'promoteUser'에서 던진 BadRequestException 또는 NotFoundException
        failedCases.push({
          userId: userIds[index],
          reason:
            result.reason?.message?.message ||
            result.reason?.message ||
            '알 수 없는 오류',
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
   * 승진 대상자 목록 조회 (N+1 쿼리 해결)
   */
  async getPromotionCandidates(
    targetPosition: PositionCode.MANAGER | PositionCode.DIRECTOR,
  ) {
    let sourcePositionId: number;

    if (targetPosition === PositionCode.MANAGER) {
      sourcePositionId = await this.getPositionId(PositionCode.SFP);
    } else if (targetPosition === PositionCode.DIRECTOR) {
      sourcePositionId = await this.getPositionId(PositionCode.MANAGER);
    } else {
      throw new BadRequestException('Invalid target position');
    }

    // 1. 대상 사용자 목록 조회
    const users = await this.userRepo.find({
      where: {
        positionId: sourcePositionId,
        isActive: true,
        deletedAt: IsNull(),
      },
      relations: ['position'],
    });

    // 2. 대상자들의 자격 요건 일괄 검사
    const eligibilityMap = await this.checkEligibilityBatch(users);

    // 3. 인메모리 데이터 조합
    const results = users.map((user) => {
      const eligibility = eligibilityMap.get(user.userId) || {
        isEligible: false,
        unmetConditions: ['데이터 조회 오류'],
      };
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
    });

    // 전체 반환 (프론트에서 필터링: 충족 / 미충족)
    return results;
  }

  // --- N+1 쿼리 해결을 위한 일괄 검사 함수 ---
  /**
   * 사용자 목록을 받아 모든 자격 요건을 일괄 조회 및 검사
   */
  private async checkEligibilityBatch(users: User[]) {
    if (users.length === 0) {
      return new Map();
    }

    const userIds = users.map((u) => u.userId);

    // --- 1. 모든 필요 데이터 일괄 프리패치 (Pre-fetch) ---

    // 조건 1/2: 개인 누적 실적 및 평균 IQA
    const { perfMap, iqaMap } = await this.getPersonalPerformanceBatch(userIds);

    // 조건 3: 직계 추천 2명
    const directRecruitMap = await this.getDirectRecruitCountBatch(userIds);

    // 조건 4/5: 산하 10/30명, 직전 3개월 산하 실적 1000/3000만
    const { downlineCountMap, downlinePerfMap } =
      await this.getDownlineMetricsBatch(userIds);

    // 조건 6 (지사장용): 본부장 승진일
    const managerPosId = await this.getPositionId(PositionCode.MANAGER);
    const promotionDateMap = await this.getLatestPositionChangeDateBatch(
      userIds,
      managerPosId,
    );

    // 직급 ID 미리 조회
    const sfpPosId = await this.getPositionId(PositionCode.SFP);
    const directorPosId = await this.getPositionId(PositionCode.DIRECTOR);

    // --- 2. 인메모리 검사 ---
    const results = new Map<number, any>();

    for (const user of users) {
      let eligibilityCheck;

      if (user.positionId === sfpPosId) {
        // 본부장 승진 검사 (인메모리)
        eligibilityCheck = this.checkManagerEligibility_InMemory(
          user,
          perfMap.get(user.userId) || 0,
          iqaMap.get(user.userId) || 0,
          directRecruitMap.get(user.userId) || 0,
          downlineCountMap.get(user.userId) || 0,
          downlinePerfMap.get(user.userId) || 0,
        );
        eligibilityCheck.newPositionId = managerPosId; // 승진할 직급 ID 추가
      } else if (user.positionId === managerPosId) {
        // 지사장 승진 검사 (인메모리)
        eligibilityCheck = this.checkDirectorEligibility_InMemory(
          user,
          iqaMap.get(user.userId) || 0,
          downlineCountMap.get(user.userId) || 0,
          downlinePerfMap.get(user.userId) || 0,
          promotionDateMap.get(user.userId) || null,
        );
        eligibilityCheck.newPositionId = directorPosId; // 승진할 직급 ID 추가
      } else {
        eligibilityCheck = {
          isEligible: false,
          unmetConditions: ['승진 대상 아님'],
          newPositionId: null,
        };
      }
      results.set(user.userId, eligibilityCheck);
    }
    return results;
  }

  // --- 1. 본부장 승진 조건 검사 ---
  private async checkManagerEligibility(user: User) {
    // (단일 실행 시에만 사용)
    const [
      personalPerf,
      avgIQA,
      directRecruits,
      downlineCount,
      downlinePerf3M,
    ] = await Promise.all([
      this.getPersonalCumulativePerformance(user.userId),
      this.getAverageIQA(user.userId),
      this.getDirectRecruitCount(user.userId),
      this.getDownlineCount(user.userId),
      this.getDownlinePerformance(user.userId, 3),
    ]);

    return this.checkManagerEligibility_InMemory(
      user,
      personalPerf,
      avgIQA,
      directRecruits,
      downlineCount,
      downlinePerf3M,
    );
  }

  /** 본부장 승진 조건 (인메모리 검사) */
  private checkManagerEligibility_InMemory(
    user: User,
    personalPerf: number,
    avgIQA: number,
    directRecruits: number,
    downlineCount: number,
    downlinePerf3M: number,
  ) {
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
    if (avgIQA < 80) {
      unmetConditions.push(`IQA 유지율 80% 미만 (현재 ${avgIQA.toFixed(2)}%)`);
      falseCount++;
    } else {
      unmetConditions.push(`IQA 유지율 80% 충족 (현재 ${avgIQA.toFixed(2)}%)`);
    }

    // 조건 4: 직계 추천 2명
    if (directRecruits < 2) {
      unmetConditions.push(`직계 추천인 2명 미만 (현재 ${directRecruits}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`직계 추천인 2명 이상 (현재 ${directRecruits}명)`);
    }

    // 조건 5: 산하 10명 (1~10 depth)
    if (downlineCount < 10) {
      unmetConditions.push(`산하 10명 미만 (현재 ${downlineCount}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`산하 10명 이상 (현재 ${downlineCount}명)`);
    }

    // 조건 6: 직전 3개월 산하 실적 1000만 (1~10 depth)
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
    // (단일 실행 시에만 사용)
    const managerPosId = await this.getPositionId(PositionCode.MANAGER);

    const [avgIQA, downlineCount, downlinePerf3M, managerPromotionDate] =
      await Promise.all([
        this.getAverageIQA(user.userId),
        this.getDownlineCount(user.userId),
        this.getDownlinePerformance(user.userId, 3),
        this.getLatestPositionChangeDate(user.userId, managerPosId),
      ]);

    return this.checkDirectorEligibility_InMemory(
      user,
      avgIQA,
      downlineCount,
      downlinePerf3M,
      managerPromotionDate,
    );
  }

  /** 지사장 승진 조건 (인메모리 검사) */
  private checkDirectorEligibility_InMemory(
    user: User,
    avgIQA: number,
    downlineCount: number,
    downlinePerf3M: number,
    managerPromotionDate: Date | null,
  ) {
    const unmetConditions: string[] = [];
    const checkDate = dayjs();
    let falseCount = 0;

    // 조건 1: 본부장 승진 7개월 경과
    if (!managerPromotionDate) {
      unmetConditions.push('본부장 승진 이력 없음');
      falseCount++;
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
    if (avgIQA < 80) {
      unmetConditions.push(`IQA 유지율 80% 미만 (현재 ${avgIQA.toFixed(2)}%)`);
      falseCount++;
    } else {
      unmetConditions.push(`IQA 유지율 80% 충족 (현재 ${avgIQA.toFixed(2)}%)`);
    }

    // 조건 3: 산하 30명
    if (downlineCount < 30) {
      unmetConditions.push(`산하 30명 미만 (현재 ${downlineCount}명)`);
      falseCount++;
    } else {
      unmetConditions.push(`산하 30명 이상 (현재 ${downlineCount}명)`);
    }

    // 조건 4: 직전 3개월 산하 실적 3000만
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

  // --- 헬퍼 메서드 (단일 조회용) ---

  private async getPersonalCumulativePerformance(
    userId: number,
  ): Promise<number> {
    const currentMonth = dayjs().format('YYYY-MM');
    const result = await this.perfRepo.sum('settlementAmount', {
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
      where: { recommenderId: userId, isActive: true, deletedAt: IsNull() },
    });
  }

  private async getDownlineCount(ancestorId: number): Promise<number> {
    // 1~10 depth, 활성 사용자만
    return this.closureRepo
      .createQueryBuilder('closure')
      .innerJoin(
        'closure.descendant',
        'user',
        'user.isActive = :isActive AND user.deletedAt IS NULL',
        { isActive: true },
      )
      .where('closure.ancestorId = :ancestorId', { ancestorId })
      .andWhere('closure.depth BETWEEN 1 AND 10')
      .getCount();
  }

  private async getDownlinePerformance(
    ancestorId: number,
    months: number,
  ): Promise<number> {
    // 1. 산하 10단계 활성 유저 ID 목록 조회
    const downlines = await this.closureRepo
      .createQueryBuilder('closure')
      .innerJoin(
        'closure.descendant',
        'user',
        'user.isActive = :isActive AND user.deletedAt IS NULL',
        { isActive: true },
      )
      .select('closure.descendantId', 'descendantId') // [버그픽] 별칭 지정
      .where('closure.ancestorId = :ancestorId', { ancestorId })
      .andWhere('closure.depth BETWEEN 1 AND 10')
      .getRawMany();

    const downlineIds = downlines.map((d) => d.descendantId);
    if (downlineIds.length === 0) return 0;

    // 2. 직전 3개월 기간 계산
    const checkDate = dayjs();
    const endMonth = checkDate.subtract(1, 'month').format('YYYY-MM'); // 이번 달 제외
    const startMonth = checkDate.subtract(months, 'month').format('YYYY-MM');

    // 3. 해당 기간 실적 합산
    const result = await this.perfRepo.sum('settlementAmount', {
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

  // --- [개선] 헬퍼 메서드 (일괄 조회용) ---

  /** 개인 실적, IQA 일괄 조회 */
  private async getPersonalPerformanceBatch(userIds: number[]) {
    const currentMonth = dayjs().format('YYYY-MM');
    const qb = this.perfRepo
      .createQueryBuilder('perf')
      .select('perf.userId', 'userId')
      .addSelect('SUM(perf.settlementAmount)', 'totalPerf')
      .addSelect('AVG(perf.iqaMaintenanceRate)', 'avgIQA')
      .where('perf.userId IN (:...userIds)', { userIds })
      .andWhere('perf.yearMonth < :currentMonth', { currentMonth })
      .groupBy('perf.userId');

    const results = await qb.getRawMany();
    const perfMap = new Map<number, number>();
    const iqaMap = new Map<number, number>();
    results.forEach((r) => {
      perfMap.set(r.userId, Number(r.totalPerf || 0));
      iqaMap.set(r.userId, Number(r.avgIQA || 0));
    });
    return { perfMap, iqaMap };
  }

  /** 직계 추천수 일괄 조회 */
  private async getDirectRecruitCountBatch(userIds: number[]) {
    const results = await this.userRepo
      .createQueryBuilder('user')
      .select('user.recommenderId', 'recommenderId')
      .addSelect('COUNT(user.userId)', 'count')
      .where('user.recommenderId IN (:...userIds)', { userIds })
      .andWhere('user.isActive = :isActive AND user.deletedAt IS NULL', {
        isActive: true,
      })
      .groupBy('user.recommenderId')
      .getRawMany();

    const map = new Map<number, number>();
    results.forEach((r) => {
      map.set(r.recommenderId, Number(r.count || 0));
    });
    return map;
  }

  /**  산하 인원수 및 실적 일괄 조회 */
  private async getDownlineMetricsBatch(userIds: number[]) {
    // 1. 모든 대상자의 산하 10단계 활성 직원 목록 (Map<ancestorId, descendantId[]>)
    const allDownlines = await this.closureRepo
      .createQueryBuilder('closure')
      .innerJoin(
        'closure.descendant',
        'user',
        'user.isActive = :isActive AND user.deletedAt IS NULL',
        { isActive: true },
      )
      //  .select([...]) -> .select('...', '...') 별칭 지정
      .select('closure.ancestorId', 'ancestorId')
      .addSelect('closure.descendantId', 'descendantId')
      .where('closure.ancestorId IN (:...userIds)', { userIds })
      .andWhere('closure.depth BETWEEN 1 AND 10')
      .getRawMany(); // .getRawMany()는 맞습니다.

    const downlineMap = new Map<number, number[]>();
    const allDescendantIds = new Set<number>();
    allDownlines.forEach((d) => {
      // 이제 d.ancestorId 와 d.descendantId가 정상적으로 동작합니다.
      if (!downlineMap.has(d.ancestorId)) {
        downlineMap.set(d.ancestorId, []);
      }
      downlineMap.get(d.ancestorId)!.push(d.descendantId);
      allDescendantIds.add(d.descendantId);
    });

    // 2. 산하 인원수 Map 생성
    const downlineCountMap = new Map<number, number>();
    downlineMap.forEach((descendants, ancestorId) => {
      downlineCountMap.set(ancestorId, descendants.length);
    });

    if (allDescendantIds.size === 0) {
      // 산하 직원이 아무도 없으면 빈 Map 반환
      return { downlineCountMap, downlinePerfMap: new Map<number, number>() };
    }

    // 3. 산하 직원들의 3개월 실적 일괄 조회
    const checkDate = dayjs();
    const endMonth = checkDate.subtract(1, 'month').format('YYYY-MM');
    const startMonth = checkDate.subtract(3, 'month').format('YYYY-MM');

    const perfResults = await this.perfRepo
      .createQueryBuilder('perf')
      .select('perf.userId', 'userId')
      .addSelect('SUM(perf.settlementAmount)', 'total')
      .where('perf.userId IN (:...allDescendantIds)', {
        allDescendantIds: [...allDescendantIds],
      })
      .andWhere('perf.yearMonth BETWEEN :startMonth AND :endMonth', {
        startMonth,
        endMonth,
      })
      .groupBy('perf.userId')
      // [버그 수정] .getRawOne() -> .getRawMany()
      .getRawMany();

    const perfMap = new Map<number, number>(); // Map<descendantId, totalPerf>
    perfResults.forEach((p) => {
      // [버그 수정] 이제 모든 산하 직원의 실적이 루프를 돕니다.
      perfMap.set(p.userId, Number(p.total || 0));
    });

    // 4. 산하 실적 합계 Map 생성
    const downlinePerfMap = new Map<number, number>(); // Map<ancestorId, totalDownlinePerf>
    downlineMap.forEach((descendants, ancestorId) => {
      let totalPerf = 0;
      descendants.forEach((descendantId) => {
        totalPerf += perfMap.get(descendantId) || 0;
      });
      downlinePerfMap.set(ancestorId, totalPerf);
    });

    return { downlineCountMap, downlinePerfMap };
  }

  /** 본부장 승진일 일괄 조회 */
  private async getLatestPositionChangeDateBatch(
    userIds: number[],
    managerPosId: number,
  ) {
    const results = await this.historyRepo
      .createQueryBuilder('history')
      .select('history.userId', 'userId')
      .addSelect('MAX(history.changedAt)', 'changedAt')
      .where('history.userId IN (:...userIds)', { userIds })
      .andWhere('history.newPositionId = :managerPosId', { managerPosId })
      .groupBy('history.userId')
      .getRawMany();

    const map = new Map<number, Date | null>();
    results.forEach((r) => {
      map.set(r.userId, r.changedAt ? new Date(r.changedAt) : null);
    });
    return map;
  }
}
