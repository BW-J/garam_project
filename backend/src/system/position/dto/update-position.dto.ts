import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdatePositionDto {
  @IsInt()
  positionId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  positionCd: string | null;

  @IsOptional()
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
