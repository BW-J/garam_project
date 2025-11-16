import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class UpdateBoardDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isImportant?: boolean;

  // FormData로 넘어오는 JSON 문자열 (예: "[1, 2, 3]")
  @IsOptional()
  @IsString()
  deletedAttachmentIds?: string;
}
