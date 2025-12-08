import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
} from 'class-validator';

export class AdjustPerformanceDto {
  @IsInt()
  @IsNotEmpty()
  performanceId: number; // 어떤 원장의 실적을 조정할지

  @IsNumber()
  @IsNotEmpty()
  amount: number; // 조정 금액 (+/-)

  @IsString()
  @IsNotEmpty()
  reason: string; // 조정 사유
}
