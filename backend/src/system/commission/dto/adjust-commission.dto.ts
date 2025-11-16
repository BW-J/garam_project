import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
} from 'class-validator';

export class AdjustCommissionDto {
  @IsInt()
  @IsNotEmpty()
  ledgerId: number; // 👈 수정할 '요약' 테이블(Ledger)의 PK

  @IsNumber()
  @IsNotEmpty()
  adjustmentAmount: number; // 👈 조정할 금액 (+/-)

  @IsString()
  @IsOptional()
  reason?: string; // 👈 조정 사유
}
