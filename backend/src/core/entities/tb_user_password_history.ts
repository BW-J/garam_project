import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './tb_user.entity';

@Entity({ name: 'tb_user_password_history' })
@Index(['userId', 'createdAt']) // 사용자의 히스토리 조회 속도 향상
export class UserPasswordHistory {
  @PrimaryGeneratedColumn({ name: 'history_id' })
  historyId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.passwordHistory)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
