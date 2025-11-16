import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
@Entity({ name: 'tb_department' })
export class Department extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'dept_id' })
  deptId: number;

  @Column({ name: 'dept_cd', unique: true, type: 'varchar' })
  deptCd: string | null;

  @Column({ name: 'dept_nm' })
  deptNm: string;

  @Column({ name: 'parent_dept_id' })
  parentDeptId: number | null;

  @ManyToOne(() => Department, (dept) => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_dept_id' })
  parent?: Department;

  @OneToMany(() => Department, (dept) => dept.parent)
  children: Department[];

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
