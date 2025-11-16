import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseAuditEntity } from 'src/core/entities/base-audit.entity';
import { RolePermissions } from './tb_role_permissions.entity';

@Entity({ name: 'tb_menu' })
export class Menu extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'menu_id' })
  menuId: number;

  @Column({ name: 'menu_cd', unique: true, length: 50 })
  menuCd: string;

  @Column({ name: 'menu_nm', length: 100 })
  menuNm: string;

  @Column({ name: 'icon', length: 100 })
  icon: string;

  @Column({ name: 'menu_path', length: 200, nullable: true, type: 'varchar' })
  menuPath: string | null;

  @Column({ name: 'parent_menu_id' })
  parentMenuId: number | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Menu, (menu) => menu.children)
  @JoinColumn({ name: 'parent_menu_id' })
  parent?: Menu;

  @OneToMany(() => Menu, (menu) => menu.parent)
  children: Menu[];

  @OneToMany(() => RolePermissions, (permissions) => permissions.menu)
  rolePermissions: RolePermissions[];
}
