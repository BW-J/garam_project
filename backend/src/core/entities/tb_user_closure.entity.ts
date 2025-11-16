import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Index,
} from 'typeorm';
import { User } from './tb_user.entity';

@Entity({ name: 'tb_user_closure' })
@Index(['descendantId']) // 하위 노드로 상위 노드를 찾는 쿼리 최적화
export class UserClosure {
  @PrimaryColumn({ name: 'ancestor_id' })
  ancestorId: number;

  @PrimaryColumn({ name: 'descendant_id' })
  descendantId: number;

  @ManyToOne(() => User, (user) => user.descendants)
  @JoinColumn({ name: 'ancestor_id' })
  ancestor: User;

  @ManyToOne(() => User, (user) => user.ancestors)
  @JoinColumn({ name: 'descendant_id' })
  descendant: User;

  @Column()
  depth: number;
}
