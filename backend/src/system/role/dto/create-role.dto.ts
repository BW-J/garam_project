import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  roleCd: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  roleNm: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  description: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
