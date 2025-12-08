import { IsOptional, IsNumber } from 'class-validator';

export class UpdateIqaDto {
  @IsOptional()
  @IsNumber()
  iqaMaintenanceRate: number;
}
