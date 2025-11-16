import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateActionDto {
  @IsInt()
  actionId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  actionCd: string;

  @IsOptional()
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
