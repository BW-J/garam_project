import { Exclude, Expose, Type } from 'class-transformer';
import { Department } from 'src/core/entities/tb_department.entity';
import { Position } from 'src/core/entities/tb_position.entity';
import { User } from 'src/core/entities/tb_user.entity';
import { DepartmentResponseDto } from 'src/system/department/dto/department-response.dto';
import { PositionResponseDto } from 'src/system/position/dto/Position-response.dto';

@Exclude()
export class UserResponseDto {
  @Expose() userId: number;
  @Expose() loginId: string;
  @Expose() userNm: string;
  @Expose() email?: string;
  @Expose() cellPhone?: string;
  @Expose() isActive: boolean;
  @Type(() => DepartmentResponseDto)
  @Expose()
  department?: Department;
  @Type(() => PositionResponseDto)
  @Expose()
  position?: Position;
  @Type(() => UserResponseDto)
  @Expose()
  recommender: User;
  @Expose() recommenderId: number | null;
  @Expose() passwordChangedAt: Date;
  @Expose() deletedAt: Date;
  @Expose() deptId: number;
  @Expose() positionId: number;
  @Expose() birthDate: Date;

  @Expose() address: string;
}
