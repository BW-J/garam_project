import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { User } from './tb_user.entity';
import { CommissionLedgerHistory } from './tb_commission_ledger_history.entity';

@Entity({ name: 'tb_commission_ledger' })
@Index(['userId', 'yearMonth', 'commissionType'], { unique: true })
export class CommissionLedger extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number; // 증원 수수료 수급자

  @Column({ name: 'year_month', length: 7 })
  yearMonth: string;

  @Column({ name: 'commission_type', length: 50 })
  commissionType: string; // 'RECRUITMENT', 'PROMOTION_BONUS', 'ADMIN_ADJUSTMENT'

  @Column({ type: 'bigint', name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => CommissionLedgerHistory, (history) => history.ledger)
  history: CommissionLedgerHistory[];
}
