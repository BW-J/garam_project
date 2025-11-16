import { User } from 'src/core/entities/tb_user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

/**
 * 시스템 엔티티 변경 이력 로그 (Audit)
 * - DB 변경(A, U, D) 시 자동 기록
 * - userId만 저장하지만, JOIN 시 User 정보도 조회 가능
 */
@Entity({ name: 'tb_audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn({ name: 'audit_id' })
  auditId: number;

  @Column({ name: 'entity_nm', length: 100 })
  entityNm: string;

  @Column({ name: 'entity_key', length: 50, nullable: true, type: 'varchar' })
  entityKey: string | null;

  @Column({ name: 'operation', length: 20 })
  operation: 'INSERT' | 'UPDATE' | 'DELETE';

  // 실제 저장은 userId만 하지만, 조회 시 User 조인 가능
  @Column({ name: 'changed_by', type: 'int' })
  changedBy: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedByUser?: User;

  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: Record<string, { old: any; new: any }> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
