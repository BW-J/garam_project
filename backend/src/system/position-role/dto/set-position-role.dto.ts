import { IsArray, ArrayNotEmpty, IsInt, IsOptional } from 'class-validator';

export class SetPositionRolesDto {
  @IsInt()
  @IsOptional()
  positionId: number;

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  roleIds: number[];
}
