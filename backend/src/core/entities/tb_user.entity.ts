import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Department } from 'src/core/entities/tb_department.entity';
import { Position } from 'src/core/entities/tb_position.entity';
import { BaseAuditEntity } from 'src/core/entities/base-audit.entity';
import { UserRoleMap } from './tb_user_role_map.entity';
import { UserPasswordHistory } from './tb_user_password_history';
import { UserClosure } from './tb_user_closure.entity';
import { UserPositionHistory } from './tb_user_position_history.entity';

@Entity({ name: 'tb_user' })
export class User extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @Column({ name: 'login_id', length: 50, unique: true })
  loginId: string;

  @Column({ name: 'password', length: 255, select: false })
  password: string;

  @Column({ name: 'user_nm', length: 100 })
  userNm: string;

  // 관계
  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'dept_id' })
  department?: Department;

  @ManyToOne(() => Position, { nullable: true })
  @JoinColumn({ name: 'position_id' })
  position?: Position;

  @OneToMany(() => UserRoleMap, (map) => map.user)
  userRoles: UserRoleMap[];

  @OneToMany(() => UserPasswordHistory, (history) => history.user)
  passwordHistory: UserPasswordHistory[];

  // 추천인 구조
  @ManyToOne(() => User, (user) => user.children, { nullable: true })
  @JoinColumn({ name: 'recommender_id' })
  recommender?: User;

  @OneToMany(() => UserClosure, (closure) => closure.ancestor)
  descendants: UserClosure[]; // 내가 상위인 관계 (나의 하위 사용자들)

  @OneToMany(() => UserClosure, (closure) => closure.descendant)
  ancestors: UserClosure[]; // 내가 하위인 관계 (나의 상위 사용자들)

  @OneToMany(() => User, (user) => user.recommender, { nullable: true })
  children: User[];

  @Column({ name: 'recommender_id', nullable: true })
  recommenderId: number | null;
  @Column({ name: 'dept_id', nullable: true })
  deptId: number;
  @Column({ name: 'position_id', nullable: true })
  positionId: number;

  // 기타
  @Column({ name: 'email', length: 100, nullable: true })
  email?: string;

  @Column({ name: 'cell_phone', length: 20, nullable: true })
  cellPhone?: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: Date | null;

  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address?: string | null;

  @Column({ name: 'fail_count' })
  failCount: number;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', length: 45, nullable: true })
  lastLoginIp?: string;

  @Column({ name: 'last_login_agent', type: 'text', nullable: true })
  lastLoginAgent?: string;

  @OneToMany(() => UserPositionHistory, (history) => history.user)
  positionHistory: UserPositionHistory[];

  // soft delete
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deletedAt?: Date;
}
