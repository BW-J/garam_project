import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tb_login_log' })
export class LoginLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'user_id' })
  userId?: number;

  @Column({ name: 'login_id' })
  loginId: string;

  @Column({ name: 'login_time', default: () => 'CURRENT_TIMESTAMP' })
  loginTime: Date;

  @Column({ name: 'logout_time', nullable: true })
  logoutTime?: Date;

  @Column({ name: 'ip', nullable: true })
  ip?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'result', nullable: true })
  result?: string;

  @Column({ name: 'message', nullable: true })
  message?: string;

  @Column({ name: 'session_id' })
  sessionId: string;
}
