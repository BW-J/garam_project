import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../core/entities/tb_user.entity';

/**
 * 사용자 단위 행위(로그인, 메뉴접근, CRUD요청 등) 기록용
 * - 사용자 정보(User) 관계형으로 유지
 * - 사용자 이름을 JOIN 없이 쉽게 가져올 수 있음
 */
@Entity({ name: 'tb_user_activity_log' })
export class UserActivityLog {
  @PrimaryGeneratedColumn({ name: 'activity_id' })
  activityId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'action_name', length: 100, nullable: true, type: 'varchar' })
  actionName: string | null;

  @Column({ name: 'method', length: 10 })
  method: string;

  @Column({ name: 'path', length: 255 })
  path: string;

  @Column({ name: 'ip_addr', length: 50, nullable: true, type: 'varchar' })
  ipAddr: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'params', type: 'jsonb', nullable: true })
  params: Record<string, any> | null;

  @Column({ name: 'result_status', type: 'int', nullable: true })
  resultStatus: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
