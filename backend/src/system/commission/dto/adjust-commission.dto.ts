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
  ledgerId: number;

  @IsNumber()
  @IsNotEmpty()
  adjustmentAmount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
