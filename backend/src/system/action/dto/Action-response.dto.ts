import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class actionResponseDto {
  @Expose() actionId: number;
  @Expose() actionCd: string;
  @Expose() actionNm: string;
  @Expose() actionDesc: string | null;
  @Expose() isActive: boolean;
}
