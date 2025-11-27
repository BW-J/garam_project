export interface Action {
  actionId: number;
  actionCd: string;
  actionNm: string;
  actionDesc: string | null;
  isActive: boolean;
}
