import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { Performance } from './tb_performance.entity';

@Entity({ name: 'tb_performance_detail' })
export class PerformanceDetail extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'detail_id' })
  detailId: number;

  @Column({ name: 'performance_id' })
  performanceId: number;

  @ManyToOne(() => Performance, (perf) => perf.details, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'performance_id' })
  performance: Performance;

  @Column({ length: 20 }) // 'BELOW_15', 'ABOVE_15', 'ADJUSTMENT'
  category: string;

  @Column({ name: 'insurance_premium', type: 'bigint', default: 0 })
  insurancePremium: number;

  @Column({ type: 'bigint', default: 0 })
  withdrawal: number;

  @Column({ type: 'bigint', default: 0 })
  cancellation: number;

  @Column({ type: 'bigint', default: 0 })
  lapse: number;

  @Column({ name: 'calculated_amount', type: 'bigint', default: 0 })
  calculatedAmount: number;

  @Column({ type: 'text', nullable: true })
  note: string;
}
