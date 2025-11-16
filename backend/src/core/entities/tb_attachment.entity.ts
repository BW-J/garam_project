import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { Board } from './tb_board.entity';

@Entity({ name: 'tb_attachment' })
export class Attachment extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ name: 'attach_id' })
  attachId: number;

  @Column({ name: 'board_id' })
  boardId: number;

  @ManyToOne(() => Board, (board) => board.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  @Column({ name: 'save_name', length: 500 })
  saveName: string; // UUID로 생성된 실제 파일명

  @Column({ type: 'bigint' })
  size: number;

  @Column({ name: 'mime_type', length: 100, nullable: true })
  mimeType: string;
}
