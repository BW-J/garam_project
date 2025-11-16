import { IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class SearchDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deptCd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deptNm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
