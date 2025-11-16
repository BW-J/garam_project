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
import { CommissionLedger } from './tb_commission_ledger.entity';

@Entity({ name: 'tb_commission_ledger_history' })
@Index(['ledgerId'])
@Index(['userId', 'yearMonth', 'commissionType']) // 👈 [신규] 복합 인덱스
export class CommissionLedgerHistory extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'history_id' })
  historyId: number;

  @Column({ name: 'ledger_id' })
  ledgerId: number;

  @ManyToOne(() => CommissionLedger, (ledger) => ledger.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ledger_id' })
  ledger: CommissionLedger;

  // 👇 [신규] 빠른 조회를 위한 중복 필드 (Type 에러 해결용)
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'year_month', length: 7 })
  yearMonth: string;

  @Column({ name: 'commission_type', length: 50 })
  commissionType: string;

  // --- 상세 데이터 ---

  @Column({ type: 'bigint' })
  amount: number; // 개별 발생 금액

  @Column({ name: 'source_user_id' })
  sourceUserId: number; // 실적 발생자

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null; // 개별 계산 근거

  // 관계 정의 (조회 시 사용)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' }) // 👈 userId 기준
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'source_user_id' })
  sourceUser: User;
}
