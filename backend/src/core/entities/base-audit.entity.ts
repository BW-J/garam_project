import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export abstract class BaseAuditEntity {
  @Column({ name: 'created_by', nullable: true, type: 'int' })
  createdBy: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true, type: 'int' })
  updatedBy: number | null;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @BeforeInsert()
  setCreateAuditFields() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdateAuditFields() {
    this.updatedAt = new Date();
  }

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
