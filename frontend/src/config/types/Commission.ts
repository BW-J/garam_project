import type { User } from './User';

// 실적 상세
export interface PerformanceDetail {
  detailId: number;
  performanceId: number;
  category: 'BELOW_15' | 'ABOVE_15' | 'ADJUSTMENT';
  insurancePremium: number;
  withdrawal: number;
  cancellation: number;
  lapse: number;
  calculatedAmount: number;
  note?: string;
  updatedAt?: string;
}

//  실적 원장 (PerformanceData -> Performance)
export interface Performance {
  id: number;
  userId: number;
  yearMonth: string;
  iqaMaintenanceRate: number;
  settlementAmount: number;
  truncatedAmount: number;
  isActive: boolean;
  user?: User;
  details?: PerformanceDetail[]; // Join된 상세
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
