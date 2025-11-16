import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { User } from './tb_user.entity';

@Entity({ name: 'tb_performance_data' })
@Index(['userId', 'yearMonth'], { unique: true }) // 한 사용자는 월별 하나의 실적만 가짐
export class PerformanceData extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'year_month', length: 7 }) // 'YYYY-MM'
  yearMonth: string;

  @Column({ name: 'insurance_premium', type: 'bigint', default: 0 })
  insurancePremium: number;

  @Column({ type: 'bigint', default: 0 })
  withdrawal: number;

  @Column({ type: 'bigint', default: 0 })
  cancellation: number;

  @Column({ type: 'bigint', default: 0 })
  lapse: number;

  @Column({
    name: 'iqa_maintenance_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0.0,
  })
  iqaMaintenanceRate: number;

  @Column({ name: 'settlement_amount', type: 'bigint', default: 0 })
  settlementAmount: number;

  @Column({ name: 'truncated_amount', type: 'bigint', default: 0 })
  truncatedAmount: number;
}
