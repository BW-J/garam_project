import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Position } from './tb_position.entity';
import { Role } from './tb_role.entity';

@Entity({ name: 'tb_position_role_map' })
export class PositionRoleMap {
  @PrimaryColumn({ name: 'position_id' })
  positionId: number;

  @PrimaryColumn({ name: 'role_id' })
  roleId: number;

  @ManyToOne(() => Position, (position) => position.positionRoles)
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @ManyToOne(() => Role, (role) => role.positionRoles)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'created_by', nullable: true, type: 'int' })
  createdBy: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true, type: 'int' })
  updatedBy: number | null;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
