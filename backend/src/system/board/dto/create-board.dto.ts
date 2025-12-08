import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ obj, key }) => {
    const rawValue = obj[key]; // 원본 값 가져오기 ('true' or 'false' string)
    if (rawValue === 'true' || rawValue === true) return true;
    if (rawValue === 'false' || rawValue === false) return false;
    return rawValue; // 그 외 값은 그대로 반환 (유효성 검사에서 걸러짐)
  })
  isImportant: boolean;
}
