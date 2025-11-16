import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { PositionRoleMap } from './tb_position_role_map.entity';

@Entity({ name: 'tb_position' })
export class Position extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'position_id' })
  positionId: number;

  @Column({ name: 'position_cd', unique: true, type: 'varchar' })
  positionCd: string | null;

  @Column({ name: 'position_nm' })
  positionNm: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => PositionRoleMap, (map) => map.position)
  positionRoles: PositionRoleMap[];
}
