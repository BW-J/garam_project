import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deptCd: string | null;

  @IsNotEmpty()
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
