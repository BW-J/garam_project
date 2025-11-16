import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CommissionQueryDto {
  @IsOptional()
  @IsString()
  @Length(7, 7) // 'YYYY-MM'
  yearMonth?: string;

  @IsOptional()
  userId?: number; // 관리자가 특정 유저를 조회할 때 사용 (사용자 본인 조회는 토큰 사용)

  @IsOptional()
  commissionType?: string;
}
