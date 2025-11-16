import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreatePositionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  positionCd: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  positionNm: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
