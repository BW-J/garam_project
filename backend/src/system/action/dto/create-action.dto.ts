import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateActionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  actionCd: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  actionNm: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actionDesc: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
