import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RoleResponseDto {
  @Expose() roleId: number;
  @Expose() roleCd: string | null;
  @Expose() roleNm: string;
  @Expose() description?: string;
  @Expose() isActive: boolean;
}
