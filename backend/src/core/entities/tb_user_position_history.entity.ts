import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './tb_user.entity';
import { Position } from './tb_position.entity';

@Entity({ name: 'tb_user_position_history' })
export class UserPositionHistory {
  @PrimaryGeneratedColumn({ name: 'history_id' })
  historyId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'previous_position_id', nullable: true })
  previousPositionId: number | null;

  @Column({ name: 'new_position_id' })
  newPositionId: number;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamp' })
  changedAt: Date;

  @Column({ name: 'change_source', length: 50 }) // 'USER_MANAGEMENT', 'PROMOTION_SYSTEM'
  changeSource: string;

  @Column({ name: 'changed_by_user_id', nullable: true })
  changedByUserId: number | null;

  // --- 관계 설정 ---
  @ManyToOne(() => User, (user) => user.positionHistory)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Position)
  @JoinColumn({ name: 'previous_position_id' })
  previousPosition: Position;

  @ManyToOne(() => Position)
  @JoinColumn({ name: 'new_position_id' })
  newPosition: Position;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser: User;
}
