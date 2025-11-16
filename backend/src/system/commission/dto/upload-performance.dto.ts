import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UploadPerformanceDto {
  @IsString()
  @IsNotEmpty()
  @Length(7, 7) // 'YYYY-MM'
  yearMonth: string;
}
