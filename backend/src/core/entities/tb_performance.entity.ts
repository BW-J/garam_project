import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { User } from './tb_user.entity';
import { PerformanceDetail } from './tb_performance_detail.entity';

@Entity({ name: 'tb_performance' })
@Index(['userId', 'yearMonth'], { unique: true })
export class Performance extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'year_month', length: 7 })
  yearMonth: string;

  @Column({
    name: 'iqa_maintenance_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  iqaMaintenanceRate: number;

  @Column({ name: 'settlement_amount', type: 'bigint', default: 0 })
  settlementAmount: number;

  @Column({ name: 'truncated_amount', type: 'bigint', default: 0 })
  truncatedAmount: number;

  @OneToMany(() => PerformanceDetail, (detail) => detail.performance, {
    cascade: true,
  })
  details: PerformanceDetail[];
}
