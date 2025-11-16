import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PositionResponseDto {
  @Expose() positionId: number;
  @Expose() positionCd: string | null;
  @Expose() positionNm: string;
  @Expose() sortOrder?: number;
  @Expose() isActive: boolean;
}
