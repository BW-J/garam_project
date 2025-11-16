import { IsOptional, IsNumber, IsPositive, IsInt } from 'class-validator';

export class UpdatePerformanceDto {
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
  @IsNumber()
  iqaMaintenanceRate?: number;
}
