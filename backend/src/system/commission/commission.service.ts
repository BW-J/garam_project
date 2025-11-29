import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PerformanceData } from 'src/core/entities/tb_performance_data.entity';
import { CommissionLedger } from 'src/core/entities/tb_commission_ledger.entity';
import { User } from 'src/core/entities/tb_user.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { Repository, In, Between, IsNull, Brackets } from 'typeorm';
import * as xlsx from 'xlsx';
import { UpdatePerformanceDto } from './dto/update-performance.dto';
import { CommissionQueryDto } from './dto/query-commission.dto';
import { CommissionSummaryResponseDto } from './dto/commission-summary-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import dayjs from 'dayjs';
import { PromotionService } from '../promotion/promotion.service';
import { CommissionLedgerHistory } from 'src/core/entities/tb_commission_ledger_history.entity';
import {
  getEffectiveStartDate,
  getJoinMonthStr,
  getNthMonthStr,
  isCarryOverTarget,
} from 'src/common/utils/business-date.util';
import { AdjustCommissionDto } from './dto/adjust-commission.dto';
import { PositionCode } from 'src/common/constants/position-code.enum';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @InjectRepository(PerformanceData)
    private perfDataRepo: Repository<PerformanceData>,
    @InjectRepository(CommissionLedger)
    private ledgerRepo: Repository<CommissionLedger>,
    @InjectRepository(CommissionLedgerHistory)
    private ledgerHistoryRepo: Repository<CommissionLedgerHistory>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserClosure)
    private closureRepo: Repository<UserClosure>,
    @InjectRepository(UserPositionHistory)
    private positionHistoryRepo: Repository<UserPositionHistory>,
    private promotionService: PromotionService,
  ) {}

  /**
   * 헬퍼: 정산금액/절삭금액 계산
   */
  private calculateAmounts(data: Partial<PerformanceData>) {
    const premium = data.insurancePremium || 0;
    const withdrawal = data.withdrawal || 0;
    const cancellation = data.cancellation || 0;
    const lapse = data.lapse || 0;

    const settlementAmount = premium - withdrawal - cancellation - lapse;
    const truncatedAmount = Math.floor(settlementAmount / 10000) * 10000;

    return { settlementAmount, truncatedAmount };
  }

  /**
   * 1. (관리자) Excel 업로드
   */
  async uploadPerformanceData(
    yearMonth: string,
    file: Express.Multer.File,
    currentUser: any,
  ) {
    this.logger.log(`Starting performance upload for ${yearMonth}...`);

    // 1. Excel 파싱
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = xlsx.utils.sheet_to_json(sheet);

    // 2. loginId 기준으로 사용자 ID 맵핑
    const loginIds = jsonData.map((row) => row['loginId']).filter(Boolean);
    const users = await this.userRepo.find({
      where: { loginId: In(loginIds) },
      select: ['userId', 'loginId'],
    });
    const userMap = new Map(users.map((u) => [u.loginId, u.userId]));

    // 3. DB에 저장할 엔티티 생성
    const entities: PerformanceData[] = [];
    for (const row of jsonData) {
      const userId = userMap.get(row['loginId']);
      if (!userId) {
        this.logger.warn(`Skipping unknown loginId: ${row['loginId']}`);
        continue;
      }

      const perfData: Partial<PerformanceData> = {
        userId: userId,
        yearMonth: yearMonth,
        insurancePremium: Number(row['insurancePremium']) || 0,
        withdrawal: Number(row['withdrawal']) || 0,
        cancellation: Number(row['cancellation']) || 0,
        lapse: Number(row['lapse']) || 0,
        iqaMaintenanceRate: Number(row['iqaMaintenanceRate']) || 0,
        createdBy: currentUser.sub,
        updatedBy: currentUser.sub,
      };

      // 4. (요청 반영) 정산금액/절삭금액 미리 계산
      const { settlementAmount, truncatedAmount } =
        this.calculateAmounts(perfData);
      perfData.settlementAmount = settlementAmount;
      perfData.truncatedAmount = truncatedAmount;

      entities.push(this.perfDataRepo.create(perfData));
    }

    // 5. 트랜잭션: 기존 월 데이터 삭제 후 Bulk Insert
    await this.perfDataRepo.manager.transaction(async (manager) => {
      // (요청 반영) 멱등성: 기존 데이터 삭제
      await manager.delete(PerformanceData, { yearMonth });
      this.logger.log(`Deleted existing data for ${yearMonth}.`);

      // Bulk Insert
      await manager.save(PerformanceData, entities);
      this.logger.log(`Inserted ${entities.length} performance records.`);
    });

    // 실적데이터 없는 사용자 강제추가
    await this.ensureZeroPerformanceRecords(yearMonth, currentUser.sub);

    return { success: true, count: entities.length };
  }

  /**
   * 2. (관리자) 실적 데이터 수정
   */
  async updatePerformanceData(
    id: number,
    dto: UpdatePerformanceDto,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
    const perfData = await this.perfDataRepo.findOneBy({ id });
    if (!perfData) {
      throw new NotFoundException('실적 데이터를 찾을 수 없습니다.');
    }

    if (req) {
      req['_auditBefore'] = JSON.parse(JSON.stringify(perfData));
    }

    Object.assign(perfData, dto);

    // 수정 시 금액 재계산
    const { settlementAmount, truncatedAmount } =
      this.calculateAmounts(perfData);
    perfData.settlementAmount = settlementAmount;
    perfData.truncatedAmount = truncatedAmount;
    perfData.updatedBy = currentUser.sub;

    return this.perfDataRepo.save(perfData);
  }

  /**
   * 수당계산 실행
   * @param yearMonth
   * @param currentUser
   * @returns
   */
  async calculateCommissions(yearMonth: string, currentUser: any) {
    this.logger.log(`[START] Commission calculation for ${yearMonth}...`);

    //실적 데이터(PerformanceData)가 있는지 확인
    const hasPerformanceData = await this.perfDataRepo.exist({
      where: { yearMonth },
    });

    if (!hasPerformanceData) {
      this.logger.warn(
        `[ABORT] Commission calculation for ${yearMonth} aborted. No performance data found.`,
      );
      // BadRequestException을 발생시켜 프론트엔드에 명확한 에러 전달
      throw new BadRequestException(
        `${yearMonth}월의 실적 데이터가 없습니다. 계산을 진행할 수 없습니다.`,
      );
    }

    // --- 멱등성: 기존 데이터 삭제 (요약, 이력 모두) ---
    // (Join된 테이블 삭제 순서 중요: History 먼저 삭제)
    await this.ledgerHistoryRepo.delete({
      yearMonth: yearMonth,
      commissionType: In(['RECRUITMENT', 'PROMOTION_BONUS']),
    });
    await this.ledgerRepo.delete({
      yearMonth: yearMonth,
      commissionType: In(['RECRUITMENT', 'PROMOTION_BONUS']),
    });
    this.logger.log(
      `Deleted existing Ledger(Calculated) and History for ${yearMonth}.`,
    );

    // --- 1. 증원수수료 계산 (History 생성) ---
    const recruitmentHistory = await this.calculateRecruitmentCommission(
      yearMonth,
      currentUser,
    );

    // --- 2. 승진 축하금 계산 (History 생성) ---
    const { promotionBonusHistory, promotionHistory } =
      await this.calculatePromotionBonus(yearMonth, currentUser);

    const allHistoryEntries = [...recruitmentHistory, ...promotionBonusHistory];

    if (allHistoryEntries.length === 0) {
      this.logger.log('No commission history generated.');
      return { success: true, message: 'No data to calculate.' };
    }

    // --- 3. 사용자별/타입별 합계(Summary) 계산 ---
    const summaryMap = new Map<string, number>(); // Key: "userId:commissionType"
    for (const entry of allHistoryEntries) {
      const key = `${entry.userId}:${entry.commissionType}`;
      const currentSum = summaryMap.get(key) || 0;
      summaryMap.set(key, currentSum + Number(entry.amount || 0));
    }

    // --- 4. 요약(Ledger) 엔티티 생성 ---
    const summaryEntries: CommissionLedger[] = [];
    for (const [key, totalAmount] of summaryMap.entries()) {
      const [userId, commissionType] = key.split(':');
      summaryEntries.push(
        this.ledgerRepo.create({
          userId: Number(userId),
          yearMonth: yearMonth,
          commissionType: commissionType,
          totalAmount: totalAmount,
          createdBy: currentUser.sub,
          updatedBy: currentUser.sub,
        }),
      );
    }

    // (승진 대상자 중, summaryMap에 없는 경우 0원으로 강제 추가)
    if (promotionHistory && promotionHistory.length > 0) {
      for (const history of promotionHistory) {
        const userId = history.userId;
        const key = `${userId}:PROMOTION_BONUS`;
        if (!summaryMap.has(key)) {
          // 0원 지급 대상자
          summaryEntries.push(
            this.ledgerRepo.create({
              userId: userId,
              yearMonth: yearMonth,
              commissionType: 'PROMOTION_BONUS',
              totalAmount: 0,
              details: { note: '지급 대상 산하 직원 없음' },
              createdBy: currentUser.sub,
              updatedBy: currentUser.sub,
            }),
          );
        }
      }
    }

    if (summaryEntries.length > 0) {
      await this.ledgerHistoryRepo.manager.transaction(async (manager) => {
        const savedSummaries = await manager.save(
          CommissionLedger,
          summaryEntries,
        );

        const summaryLookup = new Map(
          savedSummaries.map((s) => [`${s.userId}:${s.commissionType}`, s.id]),
        );

        for (const entry of allHistoryEntries) {
          const key = `${entry.userId}:${entry.commissionType}`;
          entry.ledgerId = summaryLookup.get(key)!;
        }

        await manager.save(CommissionLedgerHistory, allHistoryEntries);
      });
    }

    this.logger.log(
      `[END] Commission calculation complete. Summaries: ${summaryEntries.length}, Histories: ${allHistoryEntries.length}`,
    );
    return { success: true, message: 'All commissions calculated.' };
  }

  /**
   * 3-1 증원수수료 계산
   * @param yearMonth
   * @param currentUser
   * @returns
   */
  async calculateRecruitmentCommission(yearMonth: string, currentUser: any) {
    this.logger.log(`Starting commission calculation for ${yearMonth}...`);
    const calculationDate = dayjs(yearMonth).toDate();
    const oneYearAgo = dayjs(calculationDate).subtract(1, 'year').toDate();

    // --- [개선] 1. 자격 검증에 필요한 데이터 일괄 조회 ---
    // 1-1. 모든 활성 사용자 정보
    const users = await this.userRepo.find({
      where: { isActive: true, deletedAt: IsNull() },
      select: ['userId', 'isActive', 'appointmentDate'],
    });
    const userMap = new Map(users.map((u) => [u.userId, u]));

    // 1-2. 모든 사용자의 12개월 누적 실적 (자격 2용)
    const twelveMonthsAgoStr = dayjs(calculationDate)
      .subtract(11, 'month')
      .format('YYYY-MM');

    const perfAggregates = await this.perfDataRepo
      .createQueryBuilder('perf')
      .select('perf.userId', 'userId')
      .addSelect('SUM(perf.settlementAmount)', 'total')
      .where('perf.yearMonth >= :startMonth', {
        startMonth: twelveMonthsAgoStr,
      })
      .andWhere('perf.yearMonth <= :endMonth', { endMonth: yearMonth })
      .groupBy('perf.userId')
      .getRawMany();

    const performanceMap = new Map(
      perfAggregates.map((p) => [p.userId, Number(p.total || 0)]),
    );

    // 1. 계산 대상 실적 조회
    const performances = await this.perfDataRepo.find({
      where: {
        yearMonth,
        //truncatedAmount: Not(0),
      },
    });

    if (performances.length === 0) return [];

    // --- [개선] 3. 실적 발생자들의 모든 상위 조상 일괄 조회 ---
    const perfUserIds = performances.map((p) => p.userId);
    const allAncestors = await this.closureRepo.find({
      where: {
        descendantId: In(perfUserIds),
        depth: Between(1, 10), // 1~10단계
      },
    });

    const ancestorMap = new Map<number, UserClosure[]>(); // K: descendantId, V: 10-depth ancestors
    for (const ancestor of allAncestors) {
      if (!ancestorMap.has(ancestor.descendantId)) {
        ancestorMap.set(ancestor.descendantId, []);
      }
      ancestorMap.get(ancestor.descendantId)!.push(ancestor);
    }

    const newHistoryEntries: Partial<CommissionLedgerHistory>[] = [];

    // 2. 각 실적(발생자)에 대해 상위 10단계(수급자)를 찾아 계산
    for (const perf of performances) {
      const payoutPerLevel =
        perf.truncatedAmount == 0
          ? perf.truncatedAmount
          : perf.truncatedAmount * 0.1; // 10%
      //if (payoutPerLevel === 0) continue;

      // 4-1. [개선] DB 쿼리 대신 Map에서 상위 조상 조회
      const ancestors = ancestorMap.get(perf.userId) || [];

      for (const ancestor of ancestors) {
        // 4. (핵심) 수급자 자격 검사
        const { isEligible, note } = this.checkRecruitmentEligibility_InMemory(
          userMap.get(ancestor.ancestorId), // Map에서 사용자 정보 전달
          performanceMap, // Map에서 실적 합계 전달
          oneYearAgo,
        );

        const actualAmount = isEligible ? payoutPerLevel : 0;

        // 5. 원장(Ledger) 항목 생성
        newHistoryEntries.push({
          userId: ancestor.ancestorId, // 수급자
          yearMonth: yearMonth,
          commissionType: 'RECRUITMENT',
          amount: actualAmount,
          sourceUserId: perf.userId, // 실적 발생자
          details: {
            sourceAmount: perf.truncatedAmount,
            rate: 0.1,
            depth: ancestor.depth,
            originalAmount: payoutPerLevel,
            isEligible: isEligible,
            note: note,
          },
          createdBy: currentUser.sub,
          updatedBy: currentUser.sub,
        });
      }
    }
    this.logger.log(
      `Recruitment Commission history count: ${newHistoryEntries.length}.`,
    );
    return newHistoryEntries;
  }

  /**
   * 3-2. 승진 축하금 계산
   * @param yearMonth
   * @param currentUser
   */
  private async calculatePromotionBonus(
    yearMonth: string,
    currentUser: any,
  ): Promise<{
    promotionBonusHistory: Partial<CommissionLedgerHistory>[];
    promotionHistory: UserPositionHistory[];
  }> {
    this.logger.log(`Calculating Promotion Bonus for ${yearMonth}...`);

    const newHistoryEntries: Partial<CommissionLedgerHistory>[] = [];
    const calculationDate = dayjs(yearMonth); // 2025-11-01
    const managerPosId = await this.promotionService.getPositionId(
      PositionCode.MANAGER,
    );

    // [개선] (1/4)
    // 1. 이미 보너스 지급에 사용된 산하 직원 ID 목록 조회
    const claimedMemberIds = new Set<number>();
    const existingBonuses = await this.ledgerHistoryRepo
      .createQueryBuilder('history')
      .select('history.sourceUserId', 'sourceUserId')
      .where('history.commissionType = :type', { type: 'PROMOTION_BONUS' })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            "history.amount > 0 AND COALESCE((history.details->>'adjustment')::boolean, false) = false",
          ).orWhere(
            "history.amount = 0 AND history.details->>'bonusMonth' IN (:...months)",
            { months: ['7개월차'] },
          );
        }),
      )
      .getRawMany();
    existingBonuses.forEach((b) => {
      if (b.sourceUserId) claimedMemberIds.add(b.sourceUserId);
    });
    this.logger.log(
      `Found ${claimedMemberIds.size} already claimed downline members.`,
    );

    // [개선] (2/4)
    // 2. 지급 대상자(승진자) 찾기
    const startDate = calculationDate.subtract(7, 'month').toDate();
    const endDate = calculationDate.toDate();

    const promotionHistory = await this.positionHistoryRepo.find({
      where: {
        newPositionId: managerPosId,
        changedAt: Between(startDate, endDate),
      },
      relations: ['user'],
      order: { changedAt: 'ASC' },
    });

    if (promotionHistory.length === 0) {
      return { promotionBonusHistory: [], promotionHistory: [] };
    }

    // --- [개선] 3. 승진자들의 모든 산하 직원 및 실적 일괄 조회 ---
    const promotedUserIds = promotionHistory.map((h) => h.userId);

    // [개선] (3/4) 모든 산하 직원(1-10depth) 일괄 조회 이미 선점된 인원은 제외
    const closureQb = this.closureRepo
      .createQueryBuilder('closure')
      .innerJoinAndSelect('closure.descendant', 'member')
      .where('closure.ancestorId IN (:...promotedUserIds)', { promotedUserIds })
      .andWhere('closure.depth BETWEEN 1 AND 10');

    if (claimedMemberIds.size > 0) {
      closureQb.andWhere('closure.descendantId NOT IN (:...claimedMemberIds)', {
        claimedMemberIds: [...claimedMemberIds],
      });
    }

    const allDownlines = await closureQb.getMany();

    // 3-1. 메모리 Map으로 구성 <승진자ID, 산하직원[]
    const downlineMap = new Map<number, User[]>();
    const allDownlineIds = new Set<number>();

    for (const closure of allDownlines) {
      if (closure.descendant) {
        if (!downlineMap.has(closure.ancestorId)) {
          downlineMap.set(closure.ancestorId, []);
        }
        downlineMap.get(closure.ancestorId)!.push(closure.descendant);
        allDownlineIds.add(closure.descendantId);
      }
    }

    if (allDownlineIds.size === 0) {
      // (이하 로직은 산하 직원이 0명이므로 실행할 필요 없음)
      this.logger.log('No eligible downlines found to check performance for.');
    }

    // [개선] (4/4) 모든 산하 직원의 '전체' 실적 일괄 조회
    // [핵심 수정] 모든 산하 직원의 '입사 후 7개월치' 실적만 일괄 조회
    // (15일 룰은 JS에서, 6개월 룰도 JS에서 처리하므로 7개월치만 가져오면 됨)
    const allPerfData =
      allDownlineIds.size === 0
        ? []
        : await this.perfDataRepo
            .createQueryBuilder('perf')
            .innerJoin(User, 'user', 'user.userId = perf.userId')
            .select('perf.userId', 'userId')
            .addSelect('perf.yearMonth', 'yearMonth')
            .addSelect('perf.settlementAmount', 'settlementAmount')
            .where('perf.userId IN (:...allDownlineIds)', {
              allDownlineIds: [...allDownlineIds],
            })
            .andWhere(
              "perf.yearMonth <= TO_CHAR(user.appointment_date + interval '6 months', 'YYYY-MM')",
            )
            .getRawMany();

    const perfMap = new Map<number, PerformanceData[]>();
    for (const perf of allPerfData) {
      if (!perfMap.has(perf.userId)) {
        perfMap.set(perf.userId, []);
      }
      perfMap.get(perf.userId)!.push(perf);
    }
    // --- (여기까지 4번의 쿼리로 모든 데이터 준비 완료) ---

    for (const history of promotionHistory) {
      const user = history.user;
      if (user === null) continue;
      if (!user.appointmentDate) continue;

      const effectivePromotionStart = getEffectiveStartDate(history.changedAt);
      const N_Payment = calculationDate.diff(effectivePromotionStart, 'month');

      if (N_Payment < 1 || N_Payment > 7) continue;

      const effectiveJoinDate = getEffectiveStartDate(user.appointmentDate);
      const employmentMonthsAtPromotion = dayjs(effectivePromotionStart).diff(
        effectiveJoinDate,
        'month',
      );

      if (N_Payment > employmentMonthsAtPromotion) {
        continue;
      }

      // 5. [개선] '입사 N개월차' 신규 산하 직원 목록 조회 (인메모리)
      const N_Employment = N_Payment;
      const newDownlines = this.findQualifiedNewDownlines_InMemory(
        user,
        N_Employment,
        downlineMap, // 준비된 Map 전달
      );

      for (const member of newDownlines) {
        const isAlreadyClaimed = claimedMemberIds.has(member.userId);

        if (isAlreadyClaimed) {
          this.logger.log(`이미 할당됐던 대상 사용자 : ${member.userNm}`);
          continue;
        }

        // 6. [개선] 6개월 누적 실적 300만원 검증 (인메모리)
        const perfCheck = this.checkDownlinePerformance_InMemory(
          member.userId,
          member.appointmentDate!,
          6,
          perfMap, // 준비된 Map 전달
        );

        const actualAmount = perfCheck.isQualified ? 2_000_000 : 0;
        const note = perfCheck.isQualified
          ? `[${member.userNm}]님 실적 충족`
          : `[${member.userNm}]님 6개월 누적 실적 300만 미달`;

        // (TODO: 룰 2, 3 - 중복 카운트 방지, 스냅샷 로직)
        newHistoryEntries.push({
          userId: user.userId, // 수급자 (A 또는 B)
          yearMonth: yearMonth,
          commissionType: 'PROMOTION_BONUS',
          amount: actualAmount,
          sourceUserId: member.userId,
          details: {
            bonusMonth: `${N_Payment}개월차`,
            sourceUserJoinDate: member.appointmentDate,
            sourceUserPerfCheck: perfCheck.details,
            isQualified: perfCheck.isQualified,
            note: note,
          },
          createdBy: currentUser.sub,
          updatedBy: currentUser.sub,
        });

        // 이중 지급 방지를 위해 즉시 세트에 추가 (B가 C를 못 쓰게)
        if (perfCheck.isQualified) {
          claimedMemberIds.add(member.userId);
        }
      }
    }

    this.logger.log(
      `Promotion Bonus history count: ${newHistoryEntries.length}.`,
    );
    return { promotionBonusHistory: newHistoryEntries, promotionHistory };
  }

  /**
   * 산하 직원의 N개월간 누적 실적 300만원 검증
   */
  private async checkDownlineAvgPerformance(
    userId: number,
    joinDate: Date,
    months: number,
  ): Promise<boolean> {
    // (룰 4: 입사월 기준 6개월)
    const joinMonth = dayjs(joinDate);
    const startMonth = joinMonth.format('YYYY-MM');
    const endMonth = joinMonth.add(months - 1, 'month').format('YYYY-MM');

    // "6개월간 누적 실적 300만원"으로 해석
    const result = await this.perfDataRepo
      .createQueryBuilder('perf')
      .select('SUM(perf.insurancePremium)', 'total')
      .where('perf.userId = :userId', { userId })
      .andWhere('perf.yearMonth >= :startMonth', { startMonth })
      .andWhere('perf.yearMonth <= :endMonth', { endMonth })
      .getRawOne();

    return Number(result?.total || 0) >= 3_000_000;
  }

  /**
   * 특정 월에 실적 데이터가 없는 활성 사용자를 찾아 0값 레코드 생성
   */
  private async ensureZeroPerformanceRecords(
    yearMonth: string,
    currentUserId: number,
  ) {
    const [year, month] = yearMonth.split('-').map(Number);
    const nextMonthDate = new Date(year, month, 1);

    // 1. 해당 월에 이미 실적 데이터가 있는 사용자 ID 목록 조회
    const existingUserIds = await this.perfDataRepo
      .createQueryBuilder('perf')
      .select('perf.userId')
      .where('perf.yearMonth = :yearMonth', { yearMonth })
      .getRawMany();

    const excludedIds = existingUserIds.map((r) => r.perf_user_id);

    // 2. 실적이 없는 '활성' 사용자 조회
    const qb = this.userRepo
      .createQueryBuilder('user')
      .select('user.userId')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.deletedAt IS NULL')
      .andWhere('user.appointment_date < :nextMonthDate', { nextMonthDate })
      .andWhere('user.userId != 0'); // 관리자 계정 제외

    if (excludedIds.length > 0) {
      qb.andWhere('user.userId NOT IN (:...ids)', { ids: excludedIds });
    }

    const missingUsers = await qb.getMany();

    if (missingUsers.length === 0) {
      return; // 모두 데이터가 있으면 종료
    }

    // 3. 0값 레코드 생성 및 Bulk Insert
    const newRecords = missingUsers.map((user) =>
      this.perfDataRepo.create({
        userId: user.userId,
        yearMonth: yearMonth,
        // 아래 값들은 엔티티 디폴트(0)가 적용되지만 명시적으로 작성
        insurancePremium: 0,
        withdrawal: 0,
        cancellation: 0,
        lapse: 0,
        iqaMaintenanceRate: 0,
        settlementAmount: 0,
        truncatedAmount: 0,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      }),
    );

    await this.perfDataRepo.save(newRecords);
    this.logger.log(
      `Auto-created ${newRecords.length} zero-performance records for ${yearMonth}.`,
    );
  }

  /**
   * 해당 월의 수당 계산 상태 확인
   */
  async getMonthStatus(yearMonth: string) {
    // 1. 가장 최근 실적 데이터 수정 시간
    const lastPerf = await this.perfDataRepo.findOne({
      where: { yearMonth },
      order: { updatedAt: 'DESC' },
      select: ['updatedAt'],
    });

    // 2. 가장 최근 수당 계산 시간 (증원수수료 기준)
    const lastLedger = await this.ledgerRepo.findOne({
      where: { yearMonth, commissionType: 'RECRUITMENT' },
      order: { createdAt: 'DESC' },
      select: ['createdAt'],
    });

    if (!lastPerf) {
      return { needsRecalculation: false, hasData: false };
    }

    // 실적은 있는데 원장이 없으면 -> 계산 필요
    if (!lastLedger) {
      return { needsRecalculation: true, hasData: true, lastCalculated: null };
    }

    // 실적 수정 시간이 원장 생성 시간보다 더 나중이면 -> 재계산 필요
    // (DB 타임스탬프 정밀도 고려하여 비교)
    const needsRecalculation =
      lastPerf.updatedAt.getTime() > lastLedger.createdAt.getTime();

    return {
      needsRecalculation,
      hasData: true,
      lastCalculated: lastLedger.createdAt,
    };
  }

  /**
   * 4. (관리자용) 실적 데이터 조회
   */
  async getPerformanceDataForAdmin(
    query: CommissionQueryDto,
    currentUser: any,
  ) {
    const qb = this.perfDataRepo
      .createQueryBuilder('perf')
      .leftJoinAndSelect('perf.user', 'user'); // 사용자 정보 JOIN

    // 날짜가 있을때만
    if (query.yearMonth) {
      qb.andWhere('perf.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }

    // 대시보드용, 연도 선택
    if (query.year) {
      qb.andWhere('perf.yearMonth LIKE :year', { year: `${query.year}-%` });
    }

    if (query.userId) {
      qb.andWhere('perf.userId = :userId', { userId: query.userId });
    }

    return qb
      .orderBy('perf.yearMonth', 'DESC')
      .addOrderBy('perf.userId', 'ASC')
      .getMany();
  }

  /**
   * 사용자용
   * @param query
   * @param userId
   * @returns
   */
  async getPerformanceDataForUser(query: CommissionQueryDto, userId: number) {
    const qb = this.perfDataRepo
      .createQueryBuilder('perf')
      .leftJoinAndSelect('perf.user', 'user')
      .where('perf.userId = :userId', { userId });

    if (query.yearMonth) {
      qb.andWhere('perf.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }

    // 대시보드용, 연도선택
    if (query.year) {
      qb.andWhere('perf.yearMonth LIKE :year', { year: `${query.year}-%` });
    }

    return qb
      .orderBy('perf.yearMonth', 'DESC')
      .addOrderBy('perf.userId', 'ASC')
      .getMany();
  }

  /**
   * 5. (관리자용) 수당 원장 조회
   */
  async getCommissionLedgerHistoryForAdmin(
    query: CommissionQueryDto,
    currentUser: any,

    commissionType?: string,
  ) {
    const qb = this.ledgerHistoryRepo
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.ledger', 'ledger')
      .leftJoinAndSelect('ledger.user', 'user')
      .leftJoinAndSelect('history.sourceUser', 'sourceUser');

    if (query.yearMonth) {
      qb.where('history.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }
    if (query.userId) {
      qb.andWhere('ledger.userId = :userId', { userId: query.userId });
    }
    if (commissionType) {
      qb.andWhere('history.commissionType = :commissionType', {
        commissionType,
      });
    }
    // (commissionType 필터 추가 가능)

    return qb.orderBy('history.historyId', 'ASC').getMany();
  }

  /**
   * 사용자용
   * @param query
   * @param userId
   * @returns
   */
  async getCommissionLedgerHistoryForUser(
    query: CommissionQueryDto,
    userId: number,
    commissionType?: string,
  ) {
    const qb = this.ledgerHistoryRepo
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.ledger', 'ledger')
      .leftJoinAndSelect('history.sourceUser', 'sourceUser')
      .where('ledger.userId = :userId', { userId });

    if (query.yearMonth) {
      qb.andWhere('history.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }
    if (commissionType) {
      qb.andWhere('history.commissionType = :commissionType', {
        commissionType,
      });
    }

    return qb.orderBy('history.historyId', 'ASC').getMany();
  }

  /**
   * [개선된 헬퍼] 증원수수료 자격 검사 (인메모리)
   */
  private checkRecruitmentEligibility_InMemory(
    user: User | undefined,
    performanceMap: Map<number, number>,
    oneYearAgo: Date,
  ): { isEligible: boolean; note: string } {
    if (!user || !user.isActive) {
      return { isEligible: false, note: '수급자 정보 없음 또는 비활성' };
    }

    if (!user.appointmentDate) {
      return { isEligible: false, note: '위촉일 미정 (수당 대상 아님)' };
    }

    const effectiveJoinDate = getEffectiveStartDate(user.appointmentDate);

    // 1. [자격 1] 위촉 1년 미만
    if (effectiveJoinDate && effectiveJoinDate > oneYearAgo) {
      return { isEligible: true, note: '입사 1년 미만 (자동 충족)' };
    }

    // 2. [자격 2] 입사 1년 초과 (최근 1년 누적 실적 300만원 검사)
    // [개선] DB 쿼리 대신 Map에서 조회
    const total = performanceMap.get(user.userId) || 0;

    if (total >= 3_000_000) {
      return {
        isEligible: true,
        note: `최근 12개월 실적 ${total.toLocaleString()}원`,
      };
    } else {
      return {
        isEligible: false,
        note: `자격 요건 미달 (12개월 실적 ${total.toLocaleString()}원)`,
      };
    }
  }

  /**
   * (핵심 로직) 증원수수료 자격 검사
   */
  private async checkRecruitmentEligibility(
    userId: number,
    calculationYearMonth: string, // 'YYYY-MM'
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user || !user.isActive) {
      return false; // 비활성 사용자 자격 없음
    }

    const calculationDate = new Date(calculationYearMonth + '-01');
    const oneYearAgo = new Date(calculationDate);
    oneYearAgo.setFullYear(calculationDate.getFullYear() - 1);

    // 1. [자격 1] 입사 1년 미만
    if (user.createdAt > oneYearAgo) {
      return true; // 실적 무관 통과
    }

    // 2. [자격 2] 입사 1년 초과 (최근 1년 누적 실적 300만원 검사)
    const twelveMonthsAgoDate = new Date(calculationDate);
    twelveMonthsAgoDate.setMonth(twelveMonthsAgoDate.getMonth() - 11);
    const startMonthStr = twelveMonthsAgoDate.toISOString().substring(0, 7); // '2024-12'

    const result = await this.perfDataRepo
      .createQueryBuilder('perf')
      .select('SUM(perf.settlementAmount)', 'total')
      .where('perf.userId = :userId', { userId })
      .andWhere('perf.yearMonth >= :startMonth', { startMonth: startMonthStr })
      .andWhere('perf.yearMonth <= :endMonth', {
        endMonth: calculationYearMonth,
      })
      .getRawOne();

    const total = Number(result?.total) || 0;
    return total >= 3_000_000;
  }

  /**
   * [재설계] 수당 요약 조회 (요약 테이블 단순 조회)
   */
  async getCommissionSummary(
    yearMonth?: string,
    userId?: number,
    commissionType?: string,
    year?: string,
  ): Promise<CommissionSummaryResponseDto[]> {
    const qb = this.ledgerRepo
      .createQueryBuilder('ledger')
      .leftJoin('ledger.user', 'user')
      .leftJoin('user.department', 'dept')
      .leftJoin('user.position', 'pos')
      .select([
        'ledger.id AS "ledgerId"',
        'ledger.yearMonth AS "yearMonth"',
        'ledger.userId AS "userId"',
        'user.loginId AS "loginId"',
        'user.userNm AS "userNm"',
        'dept.deptNm AS "deptNm"',
        'pos.positionNm AS "positionNm"',
        'ledger.totalAmount AS "totalAmount"',
        '0 AS "itemCount"',
      ])
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.deletedAt IS NULL');

    if (yearMonth) {
      qb.andWhere('ledger.yearMonth = :yearMonth', { yearMonth });
    }

    // 대시보드용, 연도 선택
    if (year) {
      qb.andWhere('ledger.yearMonth LIKE :year', { year: `${year}-%` });
    }

    if (userId != null) {
      qb.andWhere('ledger.userId = :userId', { userId });
    }
    if (commissionType) {
      qb.andWhere('ledger.commissionType = :commissionType', {
        commissionType,
      });
    }

    qb.orderBy('"yearMonth"', 'DESC').addOrderBy('"userId"', 'ASC');

    const rawData = await qb.getRawMany();
    return this.mapToSummaryDto(rawData);
  }

  private mapToSummaryDto(rawData: any[]): CommissionSummaryResponseDto[] {
    return rawData.map((raw) => ({
      ledgerId: raw.ledgerId,
      yearMonth: raw.yearMonth,
      userId: raw.userId,
      loginId: raw.loginId,
      userNm: raw.userNm,
      deptNm: raw.deptNm,
      positionNm: raw.positionNm,
      totalAmount: Number(raw.totalAmount || 0),
      itemCount: Number(raw.itemCount || 0),
    }));
  }

  async getDashboardSummary(
    yearMonth: string,
    user: any,
    commissionType: string,
  ) {
    // 1. 실적 합계 쿼리
    const perfQb = this.perfDataRepo
      .createQueryBuilder('perf')
      .select('COALESCE(SUM(perf.settlement_amount), 0)', 'total') // settlement_amount 기준
      .where('perf.year_month = :yearMonth', { yearMonth });

    // 2. 수당 합계 쿼리
    const ledgerQb = this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('COALESCE(SUM(ledger.totalAmount), 0)', 'total')
      .where('ledger.year_month = :yearMonth', { yearMonth });

    if (commissionType) {
      ledgerQb.andWhere('ledger.commissionType = :commissionType', {
        commissionType,
      });
    }

    // 3. 관리자가 아니면 본인 데이터만 필터링
    if (!user.isSuperAdmin) {
      perfQb.andWhere('perf.user_id = :userId', { userId: user.sub });
      ledgerQb.andWhere('ledger.user_id = :userId', { userId: user.sub });
    }

    // 4. 병렬 실행
    const [perfResult, ledgerResult] = await Promise.all([
      perfQb.getRawOne(),
      ledgerQb.getRawOne(),
    ]);

    return {
      yearMonth,
      settlementTotal: Number(perfResult.total || 0),
      commissionTotal: Number(ledgerResult.total || 0),
    };
  }

  /**
   * [개선된 헬퍼] N개월차 신규 산하 직원 조회 (인메모리)
   */
  private findQualifiedNewDownlines_InMemory(
    user: User,
    N: number,
    downlineMap: Map<number, User[]>, // <ancestorId, User[]>
  ): User[] {
    const allUserDownlines = downlineMap.get(user.userId) || [];
    if (!user.appointmentDate) return [];

    const targetMonthStr = getNthMonthStr(user.appointmentDate, N);
    if (!targetMonthStr) return [];

    const targetStartDate = dayjs(targetMonthStr).startOf('month').toDate();
    const targetEndDate = dayjs(targetMonthStr).endOf('month').toDate();

    let finalStartDate = targetStartDate;

    // [개선] DB 쿼리 대신 메모리에서 필터링
    return allUserDownlines.filter((member) => {
      const appDate = member.appointmentDate;
      if (!appDate) return false;
      return appDate >= finalStartDate && appDate <= targetEndDate;
    });
  }

  private async findQualifiedNewDownlines(
    user: User,
    N: number,
  ): Promise<User[]> {
    const targetMonthStr = getNthMonthStr(user.createdAt, N);
    const targetStartDate = dayjs(targetMonthStr).startOf('month').toDate();
    const targetEndDate = dayjs(targetMonthStr).endOf('month').toDate();

    const qb = this.closureRepo
      .createQueryBuilder('closure')
      .innerJoinAndSelect('closure.descendant', 'member')
      .where('closure.ancestorId = :userId', { userId: user.userId })
      .andWhere('closure.depth BETWEEN 1 AND 10');

    if (N === 1 && isCarryOverTarget(user.createdAt)) {
      const joinMonthStr = getJoinMonthStr(user.createdAt);
      const joinStartDate = dayjs(joinMonthStr).startOf('month').toDate();

      qb.andWhere(
        'member.createdAt BETWEEN :joinStartDate AND :targetEndDate',
        {
          joinStartDate,
          targetEndDate,
        },
      );
    } else {
      qb.andWhere(
        'member.createdAt BETWEEN :targetStartDate AND :targetEndDate',
        {
          targetStartDate,
          targetEndDate,
        },
      );
    }
    const results = await qb.getMany();
    return results.map((r) => r.descendant);
  }

  /**
   * [개선된 헬퍼] 산하 직원의 6개월간 누적 실적 300만원 검증 (인메모리)
   */
  private checkDownlinePerformance_InMemory(
    userId: number,
    joinDate: Date | null,
    months: number,
    perfMap: Map<number, PerformanceData[]>, // <userId, Perf[]>
  ): {
    isQualified: boolean;
    details: { checkPeriod: string; totalPerf: string };
  } {
    if (!joinDate) {
      return {
        isQualified: false,
        details: { checkPeriod: '-', totalPerf: '0' },
      };
    }
    // [개선] DB 쿼리 대신 Map에서 해당 유저의 실적 배열을 가져옴
    const userPerf = perfMap.get(userId) || [];

    // 위촉일의 유효 시작일(1일) 기준
    const effectiveStartDate = getEffectiveStartDate(joinDate);
    if (!effectiveStartDate) {
      return {
        isQualified: false,
        details: { checkPeriod: '-', totalPerf: '0' },
      };
    }
    const startMonthStr = dayjs(effectiveStartDate).format('YYYY-MM');
    const endMonthStr = dayjs(effectiveStartDate)
      .add(months - 1, 'month')
      .format('YYYY-MM');

    let totalPerf = 0;
    // [개선] 가져온 실적 배열을 순회하며 합산
    for (const perf of userPerf) {
      if (perf.yearMonth >= startMonthStr && perf.yearMonth <= endMonthStr) {
        totalPerf += Number(perf.settlementAmount);
      }
    }

    const isQualified = totalPerf >= 3_000_000;

    return {
      isQualified,
      details: {
        checkPeriod: `${startMonthStr} ~ ${endMonthStr}`,
        totalPerf: totalPerf.toLocaleString('ko-KR'),
      },
    };
  }

  /**
   * [신규 헬퍼] 산하 직원의 6개월간 누적 실적 300만원 검증 (15일 룰 적용)
   */
  private async checkDownlinePerformance(
    userId: number,
    joinDate: Date,
    months: number,
  ): Promise<{
    isQualified: boolean;
    details: { checkPeriod: string; totalPerf: string };
  }> {
    const effectiveStartDate = getEffectiveStartDate(joinDate);
    const startMonthStr = dayjs(effectiveStartDate).format('YYYY-MM');
    const endMonthStr = dayjs(effectiveStartDate)
      .add(months - 1, 'month')
      .format('YYYY-MM');

    const result = await this.perfDataRepo
      .createQueryBuilder('perf')
      .select('SUM(perf.settlementAmount)', 'total')
      .where('perf.userId = :userId', { userId })
      .andWhere('perf.yearMonth BETWEEN :startMonth AND :endMonth', {
        startMonth: startMonthStr,
        endMonth: endMonthStr,
      })
      .getRawOne();

    const totalPerf = Number(result?.total || 0);
    const isQualified = totalPerf >= 3_000_000;

    return {
      isQualified,
      details: {
        checkPeriod: `${startMonthStr} ~ ${endMonthStr}`,
        totalPerf: totalPerf.toLocaleString('ko-KR'),
      },
    };
  }

  /**
   * [신규/대체] 관리자 수당 금액 조정 (요약본 수정 + 이력 추가)
   */
  async adjustCommissionAmount(dto: AdjustCommissionDto, currentUser: any) {
    const { ledgerId, adjustmentAmount, reason } = dto;
    const currentUserId = currentUser.sub;

    return this.ledgerRepo.manager.transaction(async (manager) => {
      const ledgerRepo = manager.getRepository(CommissionLedger);
      const historyRepo = manager.getRepository(CommissionLedgerHistory);

      // 1. 원본 요약(Ledger) 레코드 찾기
      const summary = await ledgerRepo.findOne({ where: { id: ledgerId } });
      if (!summary) {
        throw new NotFoundException(
          '수정할 수당 요약 정보를 찾을 수 없습니다.',
        );
      }

      // 2. 요약본 금액 업데이트
      summary.totalAmount = Number(summary.totalAmount) + adjustmentAmount;
      summary.updatedBy = currentUserId;
      summary.details = {
        lastAdjustment: {
          amount: adjustmentAmount,
          reason: reason || '관리자 수동 조정',
          adminUserId: currentUserId,
          date: new Date().toISOString(),
        },
      };
      await ledgerRepo.save(summary);

      // 3. 상세 이력(History)에 '조정' 이력 추가
      // (요청대로 부모의 타입을 승계)
      const historyEntry = historyRepo.create({
        ledgerId: summary.id,
        userId: summary.userId,
        yearMonth: summary.yearMonth,
        commissionType: summary.commissionType,
        amount: adjustmentAmount,
        sourceUserId: currentUserId,
        details: {
          adjustment: true,
          reason: reason || '관리자 수동 조정',
          adminUserId: currentUserId,
        },
        createdBy: currentUserId,
        updatedBy: currentUserId,
      });
      await historyRepo.save(historyEntry);

      return summary; // 업데이트된 요약본 반환
    });
  }
}
