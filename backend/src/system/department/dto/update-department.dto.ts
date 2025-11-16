import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
  IsNumber,
} from 'class-validator';

export class UpdateDepartmentDto {
  @IsNumber()
  deptId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deptCd: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deptNm: string;

  @IsOptional()
  @IsInt()
  parentDeptId: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
