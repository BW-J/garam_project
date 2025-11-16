import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class SearchLogDto {
  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  entityNm?: string; // 감사 로그용 테이블명 (tb_...)

  @IsOptional()
  @IsString()
  operation?: string; // INSERT / UPDATE / DELETE

  @IsOptional()
  @IsString()
  keyword?: string; // actionName, path, entityKey 등 검색어

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
