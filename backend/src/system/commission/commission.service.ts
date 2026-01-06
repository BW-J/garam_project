import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommissionLedger } from 'src/core/entities/tb_commission_ledger.entity';
import { User } from 'src/core/entities/tb_user.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import {
  Repository,
  In,
  Between,
  IsNull,
  Brackets,
  LessThanOrEqual,
  MoreThan,
  Not,
  MoreThanOrEqual,
} from 'typeorm';
import * as xlsx from 'xlsx';
import { UpdateIqaDto } from './dto/update-iqa.dto';
import { CommissionQueryDto } from './dto/query-commission.dto';
import { CommissionSummaryResponseDto } from './dto/commission-summary-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import dayjs from 'dayjs';
import { PromotionService } from '../promotion/promotion.service';
import { CommissionLedgerHistory } from 'src/core/entities/tb_commission_ledger_history.entity';
import {
  getEffectiveStartDate,
  getNthMonthStr,
} from 'src/common/utils/business-date.util';
import { AdjustCommissionDto } from './dto/adjust-commission.dto';
import { PositionCode } from 'src/common/constants/position-code.enum';
import { Performance } from 'src/core/entities/tb_performance.entity';
import { PerformanceDetail } from 'src/core/entities/tb_performance_detail.entity';
import { UpdatePerformanceDetailDto } from './dto/update-performance-detail.dto';
import { AdjustPerformanceDto } from './dto/adjust-performance.dto';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @InjectRepository(PerformanceDetail)
    private perfDetailRepo: Repository<PerformanceDetail>,

    @InjectRepository(Performance)
    private perfRepo: Repository<Performance>,

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

  private calcDetailAmount(row: any, prefix: string, rate: number) {
    // 엑셀 컬럼명 매핑 (예: '15년납 이하 보험료')
    const insurancePremium = this.parseExcelNumber(
      row[`${prefix} 보험료`] || 0,
    );
    const withdrawal = this.parseExcelNumber(row[`${prefix} 철회`] || 0);
    const cancellation = this.parseExcelNumber(row[`${prefix} 해지`] || 0);
    const lapse = this.parseExcelNumber(row[`${prefix} 실효`] || 0);

    // 공식: (보험료 - 철회 - 해지 - 실효) * 가중치
    const netAmount = insurancePremium - withdrawal - cancellation - lapse;
    const calculatedAmount = Math.floor(netAmount * rate);

    return {
      insurancePremium,
      withdrawal,
      cancellation,
      lapse,
      calculatedAmount,
    };
  }

  private parseExcelNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // 쉼표(,)와 공백 제거 후 숫자로 변환
      const cleanStr = value.replace(/,/g, '').trim();
      if (cleanStr === '') return 0;
      const num = Number(cleanStr);
      return isNaN(num) ? 0 : num;
    }
    return 0;
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

    const uploadMonthStart = dayjs(yearMonth).startOf('month').toDate();

    // 1. Excel 파싱
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = xlsx.utils.sheet_to_json(sheet, { raw: true });

    // 2. loginId 기준으로 사용자 ID 맵핑
    const loginIds = jsonData.map((row) => row['사번']).filter(Boolean);
    const users = await this.userRepo.find({
      where: { loginId: In(loginIds) },
      select: ['userId', 'loginId', 'deletedAt'],
      withDeleted: true,
    });
    const userMap = new Map(users.map((u) => [u.loginId, u]));

    // 3. 트랜잭션 처리 (기존 데이터 삭제 -> 신규 데이터 생성)
    await this.perfRepo.manager.transaction(async (manager) => {
      // (1) 해당 월의 기존 실적 원장 삭제 (Cascade로 상세 데이터도 자동 삭제됨)
      await manager.delete(Performance, { yearMonth });

      for (const row of jsonData) {
        const loginId = row['사번'];
        const user = userMap.get(loginId);
        if (!user) {
          this.logger.warn(`Skipping unknown loginId: ${loginId}`);
          continue;
        }

        if (user.deletedAt && user.deletedAt < uploadMonthStart) {
          this.logger.warn(
            `Skipping resigned user: ${loginId} (Resigned: ${dayjs(user.deletedAt).format('YYYY-MM-DD')}, UploadMonth: ${yearMonth})`,
          );
          continue;
        }

        const userId = user.userId;
        // (2) 상세 데이터 계산 (15년납 이하: 50%, 이상: 100%)
        const below15 = this.calcDetailAmount(row, '15년납 이하', 0.5);
        const above15 = this.calcDetailAmount(row, '15년납 이상', 1.0);

        // (3) 원장 데이터 계산
        // 정산금액 = (이하 계산액 + 이상 계산액)
        const settlementAmount =
          below15.calculatedAmount + above15.calculatedAmount;
        // 절삭금액 = 정산금액에서 만원 단위 절삭
        const truncatedAmount = Math.floor(settlementAmount / 100000) * 100000;

        // (4) 원장(Summary) 저장
        const performance = manager.create(Performance, {
          userId,
          yearMonth,
          iqaMaintenanceRate: Number(row['IQA'] || 0),
          settlementAmount,
          truncatedAmount,
          createdBy: currentUser.sub,
          updatedBy: currentUser.sub,
        });
        const savedPerf = await manager.save(performance);

        // (5) 상세(Detail) 저장
        const details = [
          manager.create(PerformanceDetail, {
            performance: savedPerf,
            category: 'BELOW_15',
            ...below15,
            createdBy: currentUser.sub,
            updatedBy: currentUser.sub,
          }),
          manager.create(PerformanceDetail, {
            performance: savedPerf,
            category: 'ABOVE_15',
            ...above15,
            createdBy: currentUser.sub,
            updatedBy: currentUser.sub,
          }),
        ];
        await manager.save(details);
      }
    });

    // 실적데이터 없는 사용자 강제추가
    await this.ensureZeroPerformanceRecords(yearMonth, currentUser.sub);

    return { success: true, count: jsonData.length };
  }

  /**
   * 수당 엑셀 다운로드
   * @param yearMonth
   * @param commissionType
   * @returns
   */
  async downloadCommissionExcel(
    yearMonth: string,
    commissionType: string,
  ): Promise<Buffer> {
    // 1. 데이터 조회 (사용자 정보, 은행 정보 포함)
    const qb = this.ledgerRepo
      .createQueryBuilder('ledger')
      .withDeleted()
      .leftJoinAndSelect('ledger.user', 'user')
      .leftJoinAndSelect('user.bank', 'bank') // 은행 정보 Join
      .where('ledger.yearMonth = :yearMonth', { yearMonth })
      .andWhere('ledger.commissionType = :commissionType', { commissionType })
      .orderBy('user.userNm', 'ASC');

    const results = await qb.getMany();

    if (results.length === 0) {
      console.log('데이터 없음');
      throw new NotFoundException('해당 월의 지급 내역이 존재하지 않습니다.');
    }

    // 2. 엑셀 데이터 매핑
    const excelData = results.map((item) => ({
      귀속월: item.yearMonth,
      사번: item.user.loginId || '(삭제됨)',
      성명: item.user.userNm || '(삭제됨)',
      생년월일: item.user.residentIdFront,
      핸드폰번호: item.user.cellPhone || '',
      은행명: item.user.bank?.bankName || item.user.bankCode || '',
      계좌번호: item.user.accountNumber || '',
      예금주: item.user.accountHolder || '',
      구분: item.commissionType === 'RECRUITMENT' ? '증원수수료' : '승진축하금',
      지급액: Number(item.totalAmount || 0),
    }));

    // 3. 워크시트 생성
    const worksheet = xlsx.utils.json_to_sheet(excelData);

    // (선택) 컬럼 너비 설정
    worksheet['!cols'] = [
      { wch: 10 }, // 귀속월
      { wch: 12 }, // 사번
      { wch: 10 }, // 성명
      { wch: 10 }, // 생년월일
      { wch: 15 }, // 핸드폰
      { wch: 15 }, // 은행
      { wch: 20 }, // 계좌
      { wch: 10 }, // 예금주
      { wch: 15 }, // 구분
      { wch: 15 }, // 지급액
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '수당지급내역');

    // 4. 버퍼 생성
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * 2. (관리자) 실적 iqa 데이터 수정
   */
  async updateIqa(
    performanceId: number,
    dto: UpdateIqaDto,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
    const performance = await this.perfRepo.findOneBy({ id: performanceId });
    if (!performance) {
      throw new NotFoundException('실적 원장 정보를 찾을 수 없습니다.');
    }

    if (req) {
      req['_auditBefore'] = JSON.parse(JSON.stringify(performance));
    }

    performance.iqaMaintenanceRate = dto.iqaMaintenanceRate;
    performance.updatedBy = currentUser.sub;

    return this.perfRepo.save(performance);
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
    const hasPerformanceData = await this.perfRepo.exist({
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
    const startOfMonth = dayjs(yearMonth).startOf('month').toDate();
    const oneYearAgo = dayjs(calculationDate).subtract(1, 'year').toDate();

    // --- [개선] 1. 자격 검증에 필요한 데이터 일괄 조회 ---
    // 1-1. 모든 활성 사용자 정보
    const users = await this.userRepo.find({
      withDeleted: true,

      where: [
        { deletedAt: IsNull(), userId: Not(0) },
        { deletedAt: MoreThanOrEqual(startOfMonth), userId: Not(0) },
      ],
      select: ['userId', 'isActive', 'appointmentDate', 'deletedAt'],
    });
    const userMap = new Map(users.map((u) => [u.userId, u]));

    // 1-2. 모든 사용자의 12개월 누적 실적 (자격 2용)
    const twelveMonthsAgoStr = dayjs(calculationDate)
      .subtract(11, 'month')
      .format('YYYY-MM');

    const perfAggregates = await this.perfRepo
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
    const performances = await this.perfRepo.find({
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
        depth: MoreThan(0), // 1~10단계
      },
      order: {
        depth: 'ASC', // 가까운 조상부터 순서대로 오도록 정렬 필수
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

      // 만약 DB 정렬이 보장되지 않을 경우를 대비해 안전하게 깊이순 정렬
      ancestors.sort((a, b) => a.depth - b.depth);

      //활성 지급 단계 카운터
      let paidCount = 0;

      for (const ancestor of ancestors) {
        // 10단계를 다 채웠으면 탐색 중단
        if (paidCount >= 10) break;

        if (ancestor.ancestorId === 0) continue;

        const ancestorUser = userMap.get(ancestor.ancestorId);
        // 비활성 사용자(퇴사자)는 Skip (카운트 증가 안 함 -> 롤업 효과)
        if (!ancestorUser) {
          continue;
        }

        // 4. (핵심) 수급자 자격 검사
        const { isEligible, note } = this.checkRecruitmentEligibility_InMemory(
          ancestorUser, // Map에서 사용자 정보 전달
          performanceMap, // Map에서 실적 합계 전달
          oneYearAgo,
          startOfMonth,
        );

        // 자격 미달이어도 '활성 사용자'이므로 단계(Count)는 차지함 (금액만 0원)
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
            physicalDepth: ancestor.depth,
            logicalDepth: paidCount + 1,
            originalAmount: payoutPerLevel,
            isEligible: isEligible,
            note: note,
          },
          createdBy: currentUser.sub,
          updatedBy: currentUser.sub,
        });

        paidCount++;
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
    const directorPosId = await this.promotionService.getPositionId(
      PositionCode.DIRECTOR,
    );

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
    const startDate = calculationDate
      .subtract(6, 'month')
      .startOf('month')
      .toDate();
    const endDate = calculationDate.endOf('month').toDate();

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
    const promotedUserIds = [...new Set(promotionHistory.map((h) => h.userId))];

    // 대상자들의 '모든' 본부장 승진 이력을 미리 조회 (Bulk)
    const allUserPromotions = await this.positionHistoryRepo.find({
      where: {
        userId: In(promotedUserIds),
        //newPositionId: managerPosId,
        changedAt: LessThanOrEqual(endDate),
      },
      order: { changedAt: 'ASC' }, // 날짜 오름차순 (가장 빠른게 최초 승진)
      select: ['userId', 'changedAt', 'newPositionId'], // 필요한 필드만 조회
    });

    const userHistoryMap = new Map<number, UserPositionHistory[]>();
    for (const h of allUserPromotions) {
      if (!userHistoryMap.has(h.userId)) {
        userHistoryMap.set(h.userId, []);
      }
      userHistoryMap.get(h.userId)!.push(h);
    }

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
    // [핵심 수정] 모든 산하 직원의 '위촉 후 7개월치' 실적만 일괄 조회
    // (15일 룰은 JS에서, 6개월 룰도 JS에서 처리하므로 7개월치만 가져오면 됨)
    const allPerfData =
      allDownlineIds.size === 0
        ? []
        : await this.perfRepo
            .createQueryBuilder('perf')
            .innerJoin(User, 'user', 'user.userId = perf.userId')
            .select('perf.userId', 'userId')
            .addSelect('perf.yearMonth', 'yearMonth')
            .addSelect('perf.settlementAmount', 'settlementAmount')
            .where('perf.userId IN (:...allDownlineIds)', {
              allDownlineIds: [...allDownlineIds],
            })
            .andWhere(
              "perf.yearMonth <= TO_CHAR(user.appointmentDate + interval '6 months', 'YYYY-MM')",
            )
            .getRawMany();

    const perfMap = new Map<number, Performance[]>();
    for (const perf of allPerfData) {
      if (!perfMap.has(perf.userId)) {
        perfMap.set(perf.userId, []);
      }
      perfMap.get(perf.userId)!.push(perf);
    }
    // --- (여기까지 4번의 쿼리로 모든 데이터 준비 완료) ---

    const validPromotionHistory: UserPositionHistory[] = [];
    const TIME_THRESHOLD = 1000;
    for (const history of promotionHistory) {
      const user = history.user;
      if (user === null) continue;
      if (!user.appointmentDate) continue;
      console.log(`대상자 : ${user.userNm}`);

      const userHistories = userHistoryMap.get(user.userId);

      if (!userHistories || userHistories.length === 0) continue;

      const firstManagerPromo = userHistories.find(
        (h) => h.newPositionId === managerPosId,
      );
      if (!firstManagerPromo) continue;
      const firstPromoTime = firstManagerPromo.changedAt.getTime();
      const currentHistoryTime = history.changedAt.getTime();
      console.log(`대상자 최초 승진 시간: ${firstPromoTime}`);
      console.log(`대상자 현재 승진 시간: ${currentHistoryTime}`);
      if (Math.abs(currentHistoryTime - firstPromoTime) > TIME_THRESHOLD) {
        this.logger.log(
          `User ${user.userNm}: This record is a re-promotion (Diff > 1s). Skip.`,
        );
        continue; // 생애 최초 승진 건에 대해서만 보너스 지급 시도
      }

      const firstIndex = userHistories.indexOf(firstManagerPromo);
      const historiesAfterFirst = userHistories.slice(firstIndex + 1);

      const validPositionIds = [managerPosId, directorPosId];
      // 만약 최초 지급 기한내에 현재 직급이 맞다라는 기준이 된다면 이 조건으로 변경
      // const lastRecord = userHistories[userHistories.length - 1];
      // const hasDemotionHistory = !validPositionIds.includes(lastRecord.newPositionId);
      const hasDemotionHistory = historiesAfterFirst.some(
        (h) => !validPositionIds.includes(h.newPositionId),
      );
      if (hasDemotionHistory) {
        this.logger.log(
          `User ${user.userNm} is demoted : Has a later promotion record (FP) `,
        );
        continue; // 지급 제외
      }

      const effectivePromotionStart = getEffectiveStartDate(history.changedAt);
      const N_Payment = calculationDate.diff(effectivePromotionStart, 'month');
      console.log(`비교 시간 : ${calculationDate}`);
      console.log(`유효 승진 시작 시간 : ${effectivePromotionStart}`);
      console.log(`지급 개월차 : ${N_Payment}`);
      if (N_Payment < 1 || N_Payment > 7) continue;

      const effectiveJoinDate = getEffectiveStartDate(user.appointmentDate);
      const employmentMonthsAtPromotion = dayjs(effectivePromotionStart).diff(
        effectiveJoinDate,
        'month',
      );

      console.log(`유효 승진 축하금 개월 수 : ${employmentMonthsAtPromotion}`);
      if (N_Payment > employmentMonthsAtPromotion) {
        continue;
      }

      validPromotionHistory.push(history);

      // 5. [개선] '위촉 N개월차' 신규 산하 직원 목록 조회 (인메모리)
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
    return {
      promotionBonusHistory: newHistoryEntries,
      promotionHistory: validPromotionHistory,
    };
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
    const startOfMonth = dayjs(yearMonth).startOf('month').toDate();

    // 1. 해당 월에 이미 실적 데이터가 있는 사용자 ID 목록 조회
    const existingUserIds = await this.perfRepo
      .createQueryBuilder('perf')
      .select('perf.userId')
      .where('perf.yearMonth = :yearMonth', { yearMonth })
      .getRawMany();

    const excludedIds = existingUserIds.map((r) => r.perf_user_id);

    // 2. 실적이 없는 '활성' 사용자 조회
    const qb = this.userRepo
      .createQueryBuilder('user')
      .select('user.userId')
      .withDeleted()
      //.where('user.isActive = :isActive', { isActive: true })
      .where('1=1')
      .andWhere('user.appointmentDate < :nextMonthDate', { nextMonthDate })
      .andWhere('user.userId != 0') // 관리자 계정 제외
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.deletedAt IS NULL') // 재직자
            .orWhere('user.deletedAt >= :startOfMonth', { startOfMonth }); // 그 달 이후에 퇴사한 사람
        }),
      );

    if (excludedIds.length > 0) {
      qb.andWhere('user.userId NOT IN (:...ids)', { ids: excludedIds });
    }

    const missingUsers = await qb.getMany();

    if (missingUsers.length === 0) {
      return; // 모두 데이터가 있으면 종료
    }

    // 3. 0값 레코드 생성 및 Bulk Insert
    const newPerformances = missingUsers.map((user) =>
      this.perfRepo.create({
        userId: user.userId,
        yearMonth,
        // 아래 값들은 엔티티 디폴트(0)가 적용되지만 명시적으로 작성
        iqaMaintenanceRate: 0,
        settlementAmount: 0,
        truncatedAmount: 0,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      }),
    );

    await this.perfRepo.save(newPerformances);
    this.logger.log(
      `Auto-created ${newPerformances.length} zero-performance records for ${yearMonth}.`,
    );
  }

  /**
   * 해당 월의 수당 계산 상태 확인
   */
  async getMonthStatus(yearMonth: string) {
    // 1. 가장 최근 실적 데이터 수정 시간
    const lastPerf = await this.perfRepo.findOne({
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
    const qb = this.perfRepo
      .createQueryBuilder('perf')
      .withDeleted()
      .leftJoinAndSelect('perf.user', 'user'); // 사용자 정보 JOIN

    if (query.id) {
      qb.andWhere('perf.id = :id', { id: query.id });
      qb.leftJoinAndSelect('perf.details', 'details');
      qb.addOrderBy('details.detailId', 'ASC');
    }

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
    const qb = this.perfRepo
      .createQueryBuilder('perf')
      .leftJoinAndSelect('perf.user', 'user')
      .where('perf.userId = :userId', { userId });

    if (query.id) {
      qb.andWhere('perf.id = :id', { id: query.id });
      qb.leftJoinAndSelect('perf.details', 'details');
      qb.addOrderBy('details.detailId', 'ASC');
    }

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
   * 하위 사용자 실적 조회 (사용자용)
   */
  async getDownlinePerformanceDataForUser(
    query: CommissionQueryDto,
    ancestorId: number,
  ) {
    // 1. 하위 조직원 ID 조회 (본인 제외 depth > 0)
    const descendants = await this.closureRepo.find({
      where: { ancestorId, depth: MoreThan(0) },
      select: ['descendantId'],
    });

    const descendantIds = descendants.map((d) => d.descendantId);

    if (descendantIds.length === 0) {
      return [];
    }

    // 2. 실적 조회 (사용자 정보 포함)
    const qb = this.perfRepo
      .createQueryBuilder('perf')
      .leftJoinAndSelect('perf.user', 'user')
      .leftJoinAndSelect('user.department', 'dept')
      .leftJoinAndSelect('user.position', 'pos')
      .where('perf.userId IN (:...ids)', { ids: descendantIds });

    // 필터링
    if (query.yearMonth) {
      qb.andWhere('perf.yearMonth = :yearMonth', {
        yearMonth: query.yearMonth,
      });
    }
    // 이름 검색 등 추가 가능
    // if (query.keyword) ...

    return qb
      .orderBy('perf.yearMonth', 'DESC')
      .addOrderBy('user.userNm', 'ASC')
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
      .withDeleted()
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
    calculationStartOfMonth: Date,
  ): { isEligible: boolean; note: string } {
    if (!user) {
      return { isEligible: false, note: '수급자 정보 없음' };
    }

    if (user.deletedAt && user.deletedAt < calculationStartOfMonth) {
      // 이미 맵에서 걸러졌어야 하지만, 혹시 모르니 방어 코드
      return { isEligible: false, note: '지급 대상 기간 아님 (과거 퇴사)' };
    }

    if (!user.appointmentDate) {
      return { isEligible: false, note: '위촉일 미정 (수당 대상 아님)' };
    }

    const effectiveJoinDate = getEffectiveStartDate(user.appointmentDate);

    // 1. [자격 1] 위촉 1년 미만
    if (effectiveJoinDate && effectiveJoinDate > oneYearAgo) {
      return { isEligible: true, note: '위촉 1년 미만 (자동 충족)' };
    }

    // 2. [자격 2] 위촉 1년 초과 (최근 1년 누적 실적 300만원 검사)
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
      .withDeleted()
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
      .where('1=1');
    //.where('user.isActive = :isActive', { isActive: true })
    //.andWhere('user.deletedAt IS NULL');

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
    const perfQb = this.perfRepo
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

  /**
   * [개선된 헬퍼] 산하 직원의 6개월간 누적 실적 300만원 검증 (인메모리)
   */
  private checkDownlinePerformance_InMemory(
    userId: number,
    joinDate: Date | null,
    months: number,
    perfMap: Map<number, Performance[]>, // <userId, Perf[]>
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
   * 관리자 수당 금액 조정 (요약본 수정 + 이력 추가)
   */
  async adjustCommissionAmount(
    dto: AdjustCommissionDto,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
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
      this.validateProcessingPeriod(summary.yearMonth);

      if (req) {
        req['_auditBefore'] = JSON.parse(JSON.stringify(summary));
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

  /**
   * [수당 조정 내역 삭제]
   */
  async deleteCommissionAdjustment(
    historyId: number,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
    return this.ledgerHistoryRepo.manager.transaction(async (manager) => {
      const historyRepo = manager.getRepository(CommissionLedgerHistory);
      const ledgerRepo = manager.getRepository(CommissionLedger);

      const history = await historyRepo.findOne({ where: { historyId } });
      if (!history) throw new NotFoundException('이력을 찾을 수 없습니다.');

      // 1. 기간 제한 체크
      this.validateProcessingPeriod(history.yearMonth);

      if (req) {
        req['_auditBefore'] = JSON.parse(JSON.stringify(history));
      }

      // 2. 삭제 제한 (조정 내역만 삭제 가능)
      // details 컬럼의 JSON 내 adjustment 필드 확인
      const isAdjustment =
        history.details && (history.details as any).adjustment === true;
      if (!isAdjustment) {
        throw new BadRequestException(
          '시스템 자동 계산 내역은 삭제할 수 없습니다. 수당 재계산을 이용해주세요.',
        );
      }

      // 3. 원장(Ledger) 금액 원복 (삭제되는 금액만큼 뺌)
      const ledger = await ledgerRepo.findOne({
        where: { id: history.ledgerId },
      });
      if (ledger) {
        ledger.totalAmount =
          Number(ledger.totalAmount) - Number(history.amount);
        ledger.updatedBy = currentUser.sub;
        await ledgerRepo.save(ledger);
      }

      // 4. 이력 삭제
      await historyRepo.delete(historyId);

      return { success: true };
    });
  }

  /**
   * 실적 원장(Performance)의 합계 재계산 및 업데이트 (공통 모듈)
   */
  private async recalculatePerformanceTotal(
    performanceId: number,
    manager: any,
  ) {
    // 1. 해당 원장의 모든 상세 내역 조회
    const details = await manager.getRepository(PerformanceDetail).find({
      where: { performanceId },
    });

    // 2. 상세 내역 합산 (calculatedAmount 기준)
    const settlementAmount = details.reduce(
      (sum, item) => sum + Number(item.calculatedAmount || 0),
      0,
    );
    // 3. 절삭금액 계산
    const truncatedAmount = Math.floor(settlementAmount / 100000) * 100000;

    // 4. 원장 업데이트
    await manager.update(Performance, performanceId, {
      settlementAmount,
      truncatedAmount,
    });
  }

  /**
   *  상세 내역 수정 (15년납 이하/이상 데이터 수정용)
   */
  async updatePerformanceDetail(
    detailId: number,
    dto: UpdatePerformanceDetailDto,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
    return this.perfDetailRepo.manager.transaction(async (manager) => {
      const detailRepo = manager.getRepository(PerformanceDetail);

      const detail = await detailRepo.findOne({
        where: { detailId },
        relations: ['performance'], // 부모 정보 로드
      });
      if (!detail) throw new NotFoundException('상세 내역을 찾을 수 없습니다.');

      this.validateProcessingPeriod(detail.performance.yearMonth);

      if (req) {
        const beforeState = JSON.parse(JSON.stringify(detail));
        delete beforeState.performance; // 부모 객체는 로그에서 제외 (선택사항)
        req['_auditBefore'] = beforeState;
      }

      // 값 변경
      if (dto.insurancePremium !== undefined)
        detail.insurancePremium = dto.insurancePremium;
      if (dto.withdrawal !== undefined) detail.withdrawal = dto.withdrawal;
      if (dto.cancellation !== undefined)
        detail.cancellation = dto.cancellation;
      if (dto.lapse !== undefined) detail.lapse = dto.lapse;
      if (dto.note !== undefined) detail.note = dto.note;

      // 계산 금액 재산출 (조정 데이터가 아닌 경우에만 공식 적용)
      if (detail.category !== 'ADJUSTMENT') {
        const rate = detail.category === 'BELOW_15' ? 0.5 : 1.0;
        const net =
          Number(detail.insurancePremium) -
          Number(detail.withdrawal) -
          Number(detail.cancellation) -
          Number(detail.lapse);
        detail.calculatedAmount = Math.floor(net * rate);
      }

      detail.updatedBy = currentUser.sub;
      await detailRepo.save(detail);

      // 부모 원장 재계산
      await this.recalculatePerformanceTotal(detail.performanceId, manager);

      return detail;
    });
  }

  /**
   *  관리자 실적 조정 추가
   */
  async addPerformanceAdjustment(dto: AdjustPerformanceDto, currentUser: any) {
    return this.perfRepo.manager.transaction(async (manager) => {
      const detailRepo = manager.getRepository(PerformanceDetail);

      // 원장 존재 확인
      const performance = await manager.findOne(Performance, {
        where: { id: dto.performanceId },
      });
      if (!performance)
        throw new NotFoundException('실적 원장 정보를 찾을 수 없습니다.');

      this.validateProcessingPeriod(performance.yearMonth);

      // 조정 내역을 상세 테이블에 추가
      const adjustment = detailRepo.create({
        performance: performance,
        category: 'ADJUSTMENT',
        insurancePremium: 0, // 조정은 금액만 들어감
        calculatedAmount: dto.amount, // 조정 금액 그대로 반영
        note: dto.reason,
        createdBy: currentUser.sub,
        updatedBy: currentUser.sub,
      });
      await detailRepo.save(adjustment);

      // 부모 원장 재계산
      await this.recalculatePerformanceTotal(dto.performanceId, manager);

      return adjustment;
    });
  }

  /**
   *  상세 내역 삭제 (조정 내역 삭제용)
   */
  async deletePerformanceDetail(
    detailId: number,
    currentUser: any,
    req?: AuthorizedRequest,
  ) {
    return this.perfDetailRepo.manager.transaction(async (manager) => {
      const detailRepo = manager.getRepository(PerformanceDetail);
      const detail = await detailRepo.findOne({
        where: { detailId },
        relations: ['performance'],
      });
      if (!detail) throw new NotFoundException('데이터가 없습니다.');

      const performanceId = detail.performanceId;

      this.validateProcessingPeriod(detail.performance.yearMonth);

      if (detail.category !== 'ADJUSTMENT') {
        throw new BadRequestException(
          '시스템 집계 데이터(15년납 등)는 삭제할 수 없습니다. 수정 기능을 이용해주세요.',
        );
      }

      if (req) {
        const beforeState = JSON.parse(JSON.stringify(detail));
        delete beforeState.performance;
        req['_auditBefore'] = beforeState;
      }

      // 삭제
      await detailRepo.delete(detailId);

      // 부모 원장 재계산
      await this.recalculatePerformanceTotal(performanceId, manager);

      return { success: true };
    });
  }

  /**
   * 수정 가능 기간 검증 헬퍼
   * 규칙: 현재 날짜의 '지난 달' 데이터만 수정 가능 (슈퍼관리자 예외 없음 - 필요시 추가)
   */
  private validateProcessingPeriod(targetYearMonth: string) {
    const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
    if (targetYearMonth !== lastMonth) {
      throw new BadRequestException(
        `지난 달(${lastMonth}) 데이터만 수정 또는 조정할 수 있습니다. (요청월: ${targetYearMonth})`,
      );
    }
  }
}
