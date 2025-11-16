import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class DepartmentResponseDto {
  @Expose() deptId: number;
  @Expose() deptCd: string | null;
  @Expose() deptNm: string;
  @Expose() parentDeptId?: number | null;
  @Expose() sortOrder?: number;
  @Expose() isActive: boolean;
  @Expose()
  @Type(() => DepartmentResponseDto)
  parent?: DepartmentResponseDto | null;
}
