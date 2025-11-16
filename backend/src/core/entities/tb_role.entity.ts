import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from 'src/core/entities/base-audit.entity';
import { PositionRoleMap } from './tb_position_role_map.entity';
import { RolePermissions } from './tb_role_permissions.entity';
import { UserRoleMap } from './tb_user_role_map.entity';

@Entity({ name: 'tb_role' })
export class Role extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  roleId: number;

  @Column({ name: 'role_cd', unique: true, length: 50, type: 'varchar' })
  roleCd: string | null;

  @Column({ name: 'role_nm', length: 100 })
  roleNm: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => RolePermissions, (permissions) => permissions.role)
  rolePermissions: RolePermissions[];

  @OneToMany(() => UserRoleMap, (map) => map.role)
  userRoles: UserRoleMap[];

  @OneToMany(() => PositionRoleMap, (map) => map.role)
  positionRoles: PositionRoleMap[];
}
