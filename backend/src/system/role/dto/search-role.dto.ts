import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class SearchRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  roleCd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  roleNm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
