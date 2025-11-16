export interface Position {
  positionId: number;
  positionCd: string | null;
  positionNm: string;
  sortOrder?: number;
  isActive: boolean;
}
