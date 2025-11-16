import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from 'src/core/entities/base-audit.entity';
import { RolePermissions } from './tb_role_permissions.entity';

@Entity({ name: 'tb_action' })
export class Action extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'action_id' })
  actionId: number;

  @Column({ name: 'action_cd', unique: true, length: 50 })
  actionCd: string;

  @Column({ name: 'action_nm', length: 100 })
  actionNm: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  actionDesc: string | null;

  @OneToMany(() => RolePermissions, (permissions) => permissions.action)
  rolePermissions: RolePermissions[];
}
