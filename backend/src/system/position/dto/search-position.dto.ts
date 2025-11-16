import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class SearchPositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  positionCd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionNm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
