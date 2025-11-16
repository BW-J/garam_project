import { IsArray, ArrayNotEmpty, IsInt, IsOptional } from 'class-validator';

export class SetUserRolesDto {
  @IsInt()
  @IsOptional()
  userId: number;

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  roleIds: number[];
}
