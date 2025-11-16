import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateRoleDto {
  @IsInt()
  roleId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roleCd: string | null;

  @IsOptional()
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
