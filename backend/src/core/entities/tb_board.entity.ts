import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import type { Response } from 'express';
import { User } from './tb_user.entity';
import { Attachment } from './tb_attachment.entity';
import { Get, Param, ParseIntPipe, Res, StreamableFile } from '@nestjs/common';

@Entity({ name: 'tb_board' })
export class Board extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'board_id' })
  boardId: number;

  @Column({ name: 'board_type', type: 'varchar', length: 50 })
  boardType: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'is_important', default: false })
  isImportant: boolean;

  // 작성자 (User 엔티티와 관계 설정)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  author: User;

  // 첨부파일 관계
  @OneToMany(() => Attachment, (attachment) => attachment.board, {
    cascade: true,
  })
  attachments: Attachment[];

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
