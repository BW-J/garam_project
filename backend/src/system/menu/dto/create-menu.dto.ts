import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateMenuDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  menuCd: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  menuNm: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  menuPath: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon: string;

  @IsOptional()
  @IsInt()
  parentMenuId: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
