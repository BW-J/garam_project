import { Entity, Column, PrimaryColumn } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

@Entity({ name: 'tb_bank' })
export class Bank extends BaseAuditEntity {
  @PrimaryColumn({ name: 'bank_code', length: 10 })
  bankCode: string;

  @Column({ name: 'bank_name', length: 50 })
  bankName: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
