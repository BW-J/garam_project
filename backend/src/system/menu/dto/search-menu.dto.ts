import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class SearchMenuDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  menuCd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  menuNm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  menuPath?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
