import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class SearchActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  actionCd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionNm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actionDesc?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
