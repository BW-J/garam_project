import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CommissionSummaryResponseDto {
  @Expose() ledgerId: number;
  @Expose() yearMonth: string;
  @Expose() userId: number;
  @Expose() loginId: string;
  @Expose() userNm: string;
  @Expose() deptNm?: string;
  @Expose() positionNm?: string;
  @Expose() totalAmount: number;
  @Expose() itemCount: number; // 해당 월에 발생한 수당 건수
}
