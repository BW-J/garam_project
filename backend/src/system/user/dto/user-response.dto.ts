import { Exclude, Expose, Transform, Type } from 'class-transformer';
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
  @Expose() joinDate?: Date;
  @Expose() appointmentDate?: Date;
  @Expose() zipCode?: string;
  @Expose() addressDetail?: string;
  @Expose() bankCode?: string;
  @Expose() accountNumber?: string;
  @Expose() accountHolder?: string;
  @Expose() accountRelation?: string;

  @Expose()
  residentIdFront?: string;

  @Expose()
  @Transform(({ value }) => {
    // 값이 있으면 첫 글자만 남기고 나머지 * 처리
    if (value && value.length > 0) {
      return value.charAt(0) + '******';
    }
    return value;
  })
  residentIdBack?: string;
}
