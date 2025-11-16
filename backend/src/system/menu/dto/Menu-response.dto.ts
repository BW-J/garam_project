import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class MenuResponseDto {
  @Expose() menuId: number;
  @Expose() menuCd: string;
  @Expose() menuNm: string;
  @Expose() menuPath: string | null;
  @Expose() parentMenuId: number | null;
  @Expose() isActive: boolean;
  @Expose() icon: string;
  @Expose() sortOrder: number;
  @Type(() => MenuResponseDto)
  @Expose()
  parent?: MenuResponseDto | null;
}
