import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdatePerformanceDetailDto {
  @IsOptional()
  @IsNumber()
  insurancePremium?: number;

  @IsOptional()
  @IsNumber()
  withdrawal?: number;

  @IsOptional()
  @IsNumber()
  cancellation?: number;

  @IsOptional()
  @IsNumber()
  lapse?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
