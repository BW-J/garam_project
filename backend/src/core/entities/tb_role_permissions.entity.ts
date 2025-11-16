import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Role } from './tb_role.entity';
import { Menu } from './tb_menu.entity';
import { Action } from './tb_action.entity';
import { BaseAuditEntity } from './base-audit.entity';

@Entity({ name: 'tb_role_permissions' })
export class RolePermissions extends BaseAuditEntity {
  @PrimaryColumn({ name: 'role_id' })
  roleId: number;

  @PrimaryColumn({ name: 'menu_id' })
  menuId: number;

  @PrimaryColumn({ name: 'action_id' })
  actionId: number;

  @ManyToOne(() => Role, (role) => role.rolePermissions)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Menu, (menu) => menu.rolePermissions)
  @JoinColumn({ name: 'menu_id' })
  menu: Menu;

  @ManyToOne(() => Action, (action) => action.rolePermissions)
  @JoinColumn({ name: 'action_id' })
  action: Action;
}
