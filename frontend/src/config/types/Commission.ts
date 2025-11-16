import type { User } from './User';

/**
 * 실적 데이터 (tb_performance_data)
 */
export interface PerformanceData {
  id: number;
  userId: number;
  yearMonth: string; // 'YYYY-MM'
  insurancePremium: number;
  withdrawal: number;
  cancellation: number;
  lapse: number;
  iqaMaintenanceRate: number; // IQA 유지율
  settlementAmount: number; // 정산금액
  truncatedAmount: number; // 절삭금액
  isActive: boolean;
  createdBy: number;
  updatedBy: number;

  // JOIN된 사용자 정보 (API 응답 시)
  user?: User;
}

/**
 * 수당 원장 (tb_commission_ledger)
 */
export interface CommissionLedger {
  id: number;
  userId: number;
  yearMonth: string;
  commissionType: string;
  totalAmount: number;
  details: Record<string, any> | null; // (관리자 조정 사유 등)
  user?: User; // 수급자 (Join)
  ledgerId: number;
}

/**
 * 수당 요약 (월별/사용자별 합계)
 */
export interface CommissionSummary {
  yearMonth: string;
  userId: number;
  loginId: string;
  userNm: string;
  deptNm?: string;
  positionNm?: string;
  totalAmount: number;
  itemCount: number;
  ledgerId: number;
}

export interface CommissionLedgerHistory {
  historyId: number; //
  ledgerId: number;
  userId: number; // 수급자
  yearMonth: string;
  commissionType: string;
  amount: number;
  sourceUserId: number | null;
  details: Record<string, any> | null;
  isActive: boolean;
  createdAt: Date;
  user?: User; // 수급자 (Join)
  sourceUser?: User; // 실적 발생자 (Join)
}
