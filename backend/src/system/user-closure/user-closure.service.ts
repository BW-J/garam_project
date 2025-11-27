import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
// 👇 [삭제] User 임포트 제거
// import { User } from 'src/core/entities/tb_user.entity';

@Injectable()
export class UserClosureService {
  private readonly logger = new Logger(UserClosureService.name);

  constructor(
    @InjectRepository(UserClosure)
    private readonly closureRepo: Repository<UserClosure>,
    // @InjectRepository(User)
    // private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 신규 사용자 노드를 트리에 추가합니다. (트랜잭션 내에서 호출되어야 함)
   * @param manager - TypeORM EntityManager
   * @param userId - 새로 생성된 사용자의 ID
   * @param parentId - 추천인(부모)의 ID
   */
  async addNewNode(
    manager: EntityManager,
    userId: number,
    parentId: number | null,
  ): Promise<void> {
    const closureRepo = manager.getRepository(UserClosure);

    // 1. 자기 자신과의 관계 (depth 0) 추가
    const selfClosure = closureRepo.create({
      ancestorId: userId,
      descendantId: userId,
      depth: 0,
    });

    if (parentId === null) {
      // 1-1. 최상위 노드인 경우 (부모 없음), 자기 자신만 저장하고 종료
      await closureRepo.save(selfClosure);
      return;
    }

    // 1-2. 부모가 있는 경우, 부모의 상위 노드 관계(depth > 0)를 상속받아 INSERT

    const insertQuery = `
      INSERT INTO tb_user_closure (ancestor_id, descendant_id, depth)
      SELECT 
          ancestor_id, 
          $1 AS descendant_id, 
          depth + 1 AS depth
      FROM tb_user_closure
      WHERE descendant_id = $2
      AND depth > 0 
    `;
    await manager.query(insertQuery, [userId, parentId]);

    // 1-3. 부모와의 직접 관계 (depth 1) 및 자기 자신(depth 0) 관계 저장
    // (이제 1-2 쿼리와 중복되지 않음)
    const directClosure = closureRepo.create({
      ancestorId: parentId,
      descendantId: userId,
      depth: 1,
    });
    await closureRepo.save([selfClosure, directClosure]);

    this.logger.debug(`Closure Table: Node ${userId} added under ${parentId}.`);
  }

  /**
   * [검증] 사용자가 새 추천인(newParentId) 밑으로 이동 가능한지 검사합니다.
   * (변경 없음)
   */
  async validateMove(
    userId: number,
    newParentId: number | null,
  ): Promise<void> {
    if (newParentId === null) {
      return; // 최상위 노드로 이동은 항상 가능
    }

    // 1. 자기 자신을 추천인으로 설정하려는지 검사
    if (userId === newParentId) {
      throw new BadRequestException(
        '자기 자신을 추천인으로 설정할 수 없습니다.',
      );
    }

    // 2. 순환 참조 검사: "새로운 부모"가 "자신의 하위"인지 검사
    const isCircular = await this.closureRepo.exist({
      where: {
        ancestorId: userId, // 나(A)
        descendantId: newParentId, // 나의 하위(C)
      },
    });

    if (isCircular) {
      throw new BadRequestException(
        '자신의 하위 사용자를 추천인으로 설정할 수 없습니다. (순환 참조)',
      );
    }
  }

  /**
   * 기존 사용자 노드를 새 부모(추천인) 밑으로 이동시킵니다. (트랜잭션 내에서 호출되어야 함)
   * (변경 없음)
   */
  async moveNode(
    manager: EntityManager,
    userId: number,
    newParentId: number | null,
  ): Promise<void> {
    const closureRepo = manager.getRepository(UserClosure);

    // --- 1. 기존 관계 분리 (Disconnect) ---
    const subQueryDelete = closureRepo
      .createQueryBuilder('c')
      .select('c.descendant_id')
      .where('c.ancestor_id = :userId', { userId });

    await manager
      .createQueryBuilder()
      .delete()
      .from(UserClosure)
      .where('descendant_id IN (' + subQueryDelete.getQuery() + ')')
      .andWhere(
        `ancestor_id IN (
          SELECT ancestor_id FROM tb_user_closure WHERE descendant_id = :userId AND depth > 0
        )`,
        { userId },
      )
      .setParameters(subQueryDelete.getParameters())
      .execute();

    // --- 2. 새 관계 연결 (Connect) ---
    if (newParentId !== null) {
      const insertQuery = `
        INSERT INTO tb_user_closure (ancestor_id, descendant_id, depth)
        SELECT 
            P.ancestor_id, 
            C.descendant_id, 
            P.depth + C.depth + 1
        FROM tb_user_closure P
        JOIN tb_user_closure C ON C.ancestor_id = $1
        WHERE P.descendant_id = $2
      `;
      await manager.query(insertQuery, [userId, newParentId]);
    }

    this.logger.debug(
      `Closure Table: Node ${userId} moved under ${newParentId ?? 'ROOT'}.`,
    );
  }
}
