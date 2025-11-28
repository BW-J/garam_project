import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class BankResponseDto {
  @Expose() bankCode: string;
  @Expose() bankName: string;
  @Expose() sortOrder: number;
}
