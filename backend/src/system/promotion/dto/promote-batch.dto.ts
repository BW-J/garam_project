import { Type } from 'class-transformer';
import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class PromoteBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  userIds: number[];
}
