import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
  MaxLength,
  IsInt,
} from 'class-validator';

export class SearchUserDto {
  @IsOptional()
  @IsString()
  keyword?: string; // 이름, 로그인 ID, 이메일 통합 검색용

  @IsOptional()
  @IsString()
  @MaxLength(50)
  loginId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  userNm?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cellPhone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  deptId?: number;

  @IsOptional()
  @IsInt()
  recommenderId?: number;

  @IsOptional()
  @IsString()
  recommenderPath?: string;

  @IsOptional()
  @IsInt()
  positionId?: number;

  // 이름 기반 검색 (선택적 - ID 검색이 없을 경우 대체)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deptName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionName?: string;
}
