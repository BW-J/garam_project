import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateMenuDto {
  @IsInt()
  menuId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  menuCd: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  menuNm: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  menuPath: string | null;

  @IsOptional()
  @IsInt()
  parentMenuId: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
