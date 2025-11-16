export interface Action {
  actionId: number;
  actionCd: string;
  actionNm: string;
  actionDesc: string | null; // 👈 컬럼 확인 (description이 아님)
  isActive: boolean;
}
