import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PerformanceData } from 'src/core/entities/tb_performance_data.entity';
import { CommissionLedger } from 'src/core/entities/tb_commission_ledger.entity';
import { User } from 'src/core/entities/tb_user.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { Repository, In, MoreThan, Not, Between } from 'typeorm';
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
    // const truncatedAmount = Math.trunc(settlementAmount / 10000) * 10000;
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

    // 변경사항 적용
    Object.assign(perfData, dto);

    // (요청 반영) 수정 시 금액 재계산
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

    // --- 0. 멱등성: 기존 데이터 삭제 (요약, 이력 모두) ---
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
    // const promotionBonusHistory = await this.calculatePromotionBonus(
    //   yearMonth,
    //   currentUser,
    // );
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

    // 1. 계산 대상 실적 조회
    const performances = await this.perfDataRepo.find({
      where: {
        yearMonth,
        //truncatedAmount: Not(0),
      },
    });

    if (performances.length === 0) return [];

    const newHistoryEntries: Partial<CommissionLedgerHistory>[] = [];

    // 2. 각 실적(발생자)에 대해 상위 10단계(수급자)를 찾아 계산
    for (const perf of performances) {
      const payoutPerLevel =
        perf.truncatedAmount == 0
          ? perf.truncatedAmount
          : perf.truncatedAmount * 0.1; // 10%
      //if (payoutPerLevel === 0) continue;

      // 3. 상위 10단계 조상(수급자) 조회
      const ancestors = await this.closureRepo.find({
        where: {
          descendantId: perf.userId,
          depth: In([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), // 1~10단계
        },
      });

      for (const ancestor of ancestors) {
        // 4. (핵심) 수급자 자격 검사
        const isEligible = await this.checkRecruitmentEligibility(
          ancestor.ancestorId,
          yearMonth,
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
            note: isEligible ? '정상지급' : '자격 요건 미달',
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
   * 3-2. 승진 축하금 계산 (기본 틀)
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
    const managerPosId = await this.promotionService.getPositionId('MANAGER');

    // 이미 보너스 지급에 사용된 산하 직원 ID 목록 조회
    const claimedMemberIds = new Set<number>();
    const existingBonuses = await this.ledgerHistoryRepo.find({
      where: { commissionType: 'PROMOTION_BONUS' },
      select: ['sourceUserId'],
    });
    existingBonuses.forEach((b) => {
      if (b.sourceUserId) claimedMemberIds.add(b.sourceUserId);
    });
    this.logger.log(
      `Found ${claimedMemberIds.size} already claimed downline members.`,
    );

    // 1. 지급 대상자 찾기 승진일로부터 7개월 이내인 사용자
    const startDate = calculationDate.subtract(7, 'month').toDate();
    const endDate = calculationDate.toDate();

    const promotionHistory = await this.positionHistoryRepo.find({
      where: {
        newPositionId: managerPosId,
        //changeSource: 'PROMOTION_SYSTEM', //[룰 1] '승진 관리'로 승진한 건만 필요시 삭제
        changedAt: Between(startDate, endDate),
      },
      relations: ['user'], // user.createdAt (입사일) 필요
      order: { changedAt: 'ASC' },
    });

    for (const history of promotionHistory) {
      const user = history.user;
      if (user === null) continue;
      const effectivePromotionStart = getEffectiveStartDate(history.changedAt);
      const N_Payment = calculationDate.diff(effectivePromotionStart, 'month');

      if (N_Payment < 1 || N_Payment > 7) continue;

      const effectiveJoinDate = getEffectiveStartDate(user.createdAt);
      const employmentMonthsAtPromotion = dayjs(effectivePromotionStart).diff(
        effectiveJoinDate,
        'month',
      );
      if (N_Payment > employmentMonthsAtPromotion) {
        continue;
      }

      // 3. '입사 N개월차' 신규 산하 직원 목록 조회 (15일 룰 + 실적 이월 적용)
      const N_Employment = N_Payment;
      const newDownlines = await this.findQualifiedNewDownlines(
        user,
        N_Employment,
      );

      for (const member of newDownlines) {
        const isAlreadyClaimed = claimedMemberIds.has(member.userId);

        if (isAlreadyClaimed) {
          this.logger.log(`이미 할당됐던 대상 사용자 : ${member.userNm}`);
          continue; // 👈 [룰 2] 적용
        }

        // 4. [룰 4] 6개월 누적 실적 300만원 검증 (15일 룰 적용)
        const perfCheck = await this.checkDownlinePerformance(
          member.userId,
          member.createdAt,
          6,
        );
        if (perfCheck.isQualified) {
          // (TODO: 룰 2, 3 - 중복 카운트 방지, 스냅샷 로직)
          newHistoryEntries.push({
            userId: user.userId, // 수급자 (A 또는 B)
            yearMonth: yearMonth,
            commissionType: 'PROMOTION_BONUS',
            amount: 2_000_000,
            sourceUserId: member.userId,
            details: {
              bonusMonth: `${N_Payment}개월차`,
              sourceUserJoinDate: member.createdAt,
              sourceUserPerfCheck: perfCheck.details,
              note: `[${member.userNm}]님 실적 충족`,
            },
            createdBy: currentUser.sub,
            updatedBy: currentUser.sub,
          });

          // 👈 [룰 2] 이중 지급 방지를 위해 즉시 세트에 추가 (B가 C를 못 쓰게)
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

    // (참고: 6개월 평균 300이 누적 300인지 월 50인지...)
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
      .andWhere('user.createdAt < :nextMonthDate', { nextMonthDate })
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
    if (query.yearMonth) {
      // currentUserId는 이 메서드에서 알 수 없으므로, 필요하다면 컨트롤러에서 받아야 함.
      // 여기서는 시스템(null) 또는 임의의 관리자 ID 사용 고려.
      // 일단 로깅용이므로 0 또는 생략 가능하면 생략.
      //await this.ensureZeroPerformanceRecords(query.yearMonth, currentUser);
    }

    const qb = this.perfDataRepo
      .createQueryBuilder('perf')
      .leftJoinAndSelect('perf.user', 'user'); // 사용자 정보 JOIN

    // 날짜가 있을때만
    if (query.yearMonth) {
      qb.andWhere('perf.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }

    if (query.userId) {
      qb.andWhere('perf.userId = :userId', { userId: query.userId });
    }

    return qb
      .orderBy('perf.yearMonth', 'DESC')
      .addOrderBy('perf.id', 'ASC')
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
      .leftJoinAndSelect('history.ledger', 'ledger') // 👈 [수정] 요약본 Join
      .leftJoinAndSelect('ledger.user', 'user') // 👈 [수정] 수급자 정보 (요약본에서)
      .leftJoinAndSelect('history.sourceUser', 'sourceUser'); // 👈 [수정] 발생자 정보

    if (query.yearMonth) {
      qb.where('history.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }
    if (query.userId) {
      qb.andWhere('ledger.userId = :userId', { userId: query.userId }); // 👈 [수정] 요약본의 userId 기준
    }
    if (commissionType) {
      // 👈 [유지]
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
    const qb = this.ledgerHistoryRepo // 👈 [수정] ledgerRepo -> ledgerHistoryRepo
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.ledger', 'ledger')
      .leftJoinAndSelect('history.sourceUser', 'sourceUser')
      .where('ledger.userId = :userId', { userId }); // 👈 [수정] 요약본의 userId 기준

    if (query.yearMonth) {
      qb.andWhere('history.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }
    if (commissionType) {
      // 👈 [유지]
      qb.andWhere('history.commissionType = :commissionType', {
        commissionType,
      });
    }

    return qb.orderBy('history.historyId', 'ASC').getMany();
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
      .select('SUM(perf.insurancePremium)', 'total')
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
   * [수정] 수당 요약 조회 (통합)
   * - yearMonth가 있으면: 해당 월의 '모든 활성 사용자' 기준 조회 (0원 포함)
   * - yearMonth가 없으면: '수당 이력이 있는' 모든 데이터 조회
   */
  async getCommissionSummary_bakcup(
    yearMonth?: string,
    userId?: number,
    commissionType?: string,
  ): Promise<CommissionSummaryResponseDto[]> {
    if (yearMonth) {
      // [Case 1] 특정 월 조회 -> User 테이블 기준 LEFT JOIN
      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoin('user.department', 'dept')
        .leftJoin('user.position', 'pos')
        // 👇 핵심: 요청한 월(yearMonth)에 해당하는 원장만 LEFT JOIN
        .leftJoin(
          CommissionLedger,
          'ledger',
          'ledger.user_id = user.user_id AND ledger.year_month = :yearMonth',
          { yearMonth },
        )
        .select([
          // ledger가 없어도 요청한 월을 그대로 반환
          `'${yearMonth}' AS "yearMonth"`,
          'user.userId AS "userId"',
          'user.loginId AS "loginId"',
          'user.userNm AS "userNm"',
          'dept.deptNm AS "deptNm"',
          'pos.positionNm AS "positionNm"',
          // 👇 NULL이면 0으로 처리
          'COALESCE(SUM(ledger.amount), 0) AS "totalAmount"',
          'COUNT(ledger.id) AS "itemCount"',
        ])
        // 활성 사용자만 조회
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.deletedAt IS NULL');

      if (userId) {
        qb.andWhere('user.userId = :userId', { userId });
      }

      qb.groupBy('user.userId')
        .addGroupBy('user.loginId')
        .addGroupBy('user.userNm')
        .addGroupBy('dept.deptNm')
        .addGroupBy('pos.positionNm')
        .orderBy('user.userId', 'ASC');

      const rawData = await qb.getRawMany();
      return this.mapToSummaryDto(rawData);
    } else {
      // [Case 2] 전체 이력 조회 -> 기존 Ledger 기준 로직 유지
      const qb = this.ledgerRepo
        .createQueryBuilder('ledger')
        .leftJoin('ledger.user', 'user')
        .leftJoin('user.department', 'dept')
        .leftJoin('user.position', 'pos')
        .select([
          'ledger.yearMonth AS "yearMonth"',
          'ledger.userId AS "userId"',
          'user.loginId AS "loginId"',
          'user.userNm AS "userNm"',
          'dept.deptNm AS "deptNm"',
          'pos.positionNm AS "positionNm"',
          'SUM(ledger.amount) AS "totalAmount"',
          'COUNT(ledger.id) AS "itemCount"',
        ])
        .groupBy('ledger.yearMonth')
        .addGroupBy('ledger.userId')
        .addGroupBy('user.userId')
        .addGroupBy('user.loginId')
        .addGroupBy('user.userNm')
        .addGroupBy('dept.deptNm')
        .addGroupBy('pos.positionNm');

      if (userId) {
        qb.andWhere('ledger.userId = :userId', { userId });
      }

      qb.orderBy('"yearMonth"', 'DESC').addOrderBy('"userId"', 'ASC');

      const rawData = await qb.getRawMany();
      return this.mapToSummaryDto(rawData);
    }
  }

  /**
   * [재설계] 수당 요약 조회 (요약 테이블 단순 조회)
   */
  async getCommissionSummary(
    yearMonth?: string,
    userId?: number,
    commissionType?: string, // 👈 [신규] 타입 필터
  ): Promise<CommissionSummaryResponseDto[]> {
    // 👇 [수정] User 기준이 아닌, '요약(Ledger)' 테이블 기준으로 변경 (훨씬 빠름)
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
        'ledger.totalAmount AS "totalAmount"', // 👈 [수정] SUM() 제거
        // (itemCount는 이제 History를 JOIN해야 하므로 성능상 제외하거나, Ledger에 추가)
        '0 AS "itemCount"', // 👈 (성능을 위해 0으로 고정)
      ])
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.deletedAt IS NULL');

    if (yearMonth) {
      qb.andWhere('ledger.yearMonth = :yearMonth', { yearMonth });
    }
    if (userId) {
      qb.andWhere('ledger.userId = :userId', { userId });
    }
    if (commissionType) {
      // 👈 [신규] 타입 필터
      qb.andWhere('ledger.commissionType = :commissionType', {
        commissionType,
      });
    }

    qb.orderBy('"yearMonth"', 'DESC').addOrderBy('"userId"', 'ASC');

    const rawData = await qb.getRawMany();
    return this.mapToSummaryDto(rawData); // 👈 (mapToSummaryDto는 기존 것 재사용)
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

  async getDashboardSummary(yearMonth: string, user: any) {
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
      .select('SUM(perf.insurancePremium)', 'total')
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
        commissionType: summary.commissionType, // 👈 [핵심] 부모 타입(RECRUITMENT 등) 승계
        amount: adjustmentAmount, // 👈 조정 금액
        sourceUserId: currentUserId, // 👈 조정 실행자
        details: {
          adjustment: true, // 👈 조정 이력임을 명시
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
