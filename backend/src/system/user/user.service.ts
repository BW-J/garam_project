import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { User } from 'src/core/entities/tb_user.entity';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { BaseService } from 'src/core/services/base.service';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import {
  buildPaginationMeta,
  getPaginationParams,
} from 'src/common/utils/pagination.util';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { ConfigService } from '@nestjs/config';
import { UserPasswordService } from './user-password.service';
import { UserClosureService } from '../user-closure/user-closure.service';
import { UserGenealogyNodeDto } from './dto/user-genealogy-node.dto';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { PositionResponseDto } from '../position/dto/Position-response.dto';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import { Position } from 'src/core/entities/tb_position.entity';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserClosure)
    private closureRepository: Repository<UserClosure>,
    @InjectRepository(UserPositionHistory)
    private historyRepo: Repository<UserPositionHistory>,
    private readonly userPasswordService: UserPasswordService,
    private readonly configService: ConfigService,
    private readonly userClosureService: UserClosureService,
  ) {
    super(userRepository);
  }

  /**
   * 사용자 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createUser(
    dto: CreateUserDto,
    currentUserId: number,
  ): Promise<UserResponseDto> {
    const exists = await this.repository.findOne({
      where: { loginId: dto.loginId },
      withDeleted: true,
    });
    if (exists) throw new ConflictException('이미 존재하는 로그인 ID입니다.');

    // 1. [검증] 비밀번호 정책 검사
    const plainPassword = await this.userPasswordService.validateNewPassword(
      this.userRepository.manager,
      null,
      dto.password,
    );
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 2. [검증] 추천인 존재 여부 검사 (recommenderId가 null이 아닐 경우)
    if (dto.recommenderId) {
      const parentExists = await this.userRepository.exist({
        where: { userId: dto.recommenderId },
      });
      if (!parentExists) {
        throw new NotFoundException(
          `추천인(ID: ${dto.recommenderId})을 찾을 수 없습니다.`,
        );
      }
    }

    const entity = {
      ...dto,
      password: hashedPassword,
      isActive: dto.isActive ?? true,
      createdBy: currentUserId,
      updatedBy: currentUserId,
      passwordChangedAt: new Date(),
    };

    //  트랜잭션 시작
    const result = await this.userRepository.manager.transaction(
      async (manager) => {
        // 엔티티 인스턴스 생성 (DB 저장 X)
        const newUser = this.userRepository.create(entity);

        // 1차 저장 (INSERT) - ID 발급
        const savedUser = await manager.save(newUser);

        // 2. Closure Table 관계 생성
        await this.userClosureService.addNewNode(
          manager,
          savedUser.userId,
          savedUser.recommenderId,
        );

        // 3. 비밀번호 히스토리 저장
        await this.userPasswordService.savePasswordHistory(
          manager,
          savedUser.userId,
          savedUser.password,
        );

        const historyRepo = manager.getRepository(UserPositionHistory);
        const history = historyRepo.create({
          userId: savedUser.userId,
          previousPositionId: null, // 신규
          newPositionId: savedUser.positionId,
          changeSource: 'USER_MANAGEMENT', // '사용자 관리' 메뉴에서 생성
          changedByUserId: currentUserId,
        });
        await historyRepo.save(history);

        return savedUser;
      },
    );

    return plainToInstance(UserResponseDto, result);
  }

  /**
   * 사용자 수정
   * @param userId
   * @param dto
   * @param req
   * @returns
   */
  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    req?: AuthorizedRequest,
  ) {
    // 1. [검증] 비밀번호 변경 시, 복호화 및 정책 검사 (트랜잭션 *외부*에서)
    let plainPassword: string | null = null;
    if (dto.password) {
      plainPassword = await this.userPasswordService.validateNewPassword(
        this.userRepository.manager,
        userId,
        dto.password,
      );
    }

    // 2. 원본 데이터 조회 (트랜잭션 *외부*에서)
    const beforeUser = await this.userRepository.findOne({ where: { userId } });
    if (!beforeUser) {
      throw new NotFoundException(`User ID ${userId} not found`);
    }

    // 추천인 변경 검증 (트랜잭션 *외부*에서)
    const newRecommenderId = dto.recommenderId;
    const isRecommenderChanged =
      newRecommenderId !== undefined &&
      newRecommenderId !== beforeUser.recommenderId;

    if (isRecommenderChanged) {
      // 3-1. (자기참조, 순환참조) 검증
      await this.userClosureService.validateMove(userId, newRecommenderId);

      // 3-2. (존재여부) 검증
      if (newRecommenderId !== null) {
        const parentExists = await this.userRepository.exist({
          where: { userId: newRecommenderId },
        });
        if (!parentExists) {
          throw new NotFoundException(
            `새로운 추천인(ID: ${newRecommenderId})을 찾을 수 없습니다.`,
          );
        }
      }
    }

    // 4. 감사 인터셉터를 위해 req 객체에 'before' 상태를 주입
    if (req) {
      req['_auditBefore'] = JSON.parse(JSON.stringify(beforeUser));
    }

    const originalPositionId = beforeUser.positionId;

    // 5. 트랜잭션 시작
    const updatedUserResult = await this.userRepository.manager.transaction(
      async (manager) => {
        // DTO 복사
        const updateData: Partial<User> = {
          ...dto,
          updatedBy: req?.user?.sub,
        };

        // 비밀번호 변경 시 해싱 및 변경일자 수정
        if (plainPassword) {
          updateData.password = await bcrypt.hash(plainPassword, 10);
          updateData.passwordChangedAt = new Date();
        } else {
          delete updateData.password;
        }

        // 사용자 정보 1차 갱신 (병합)
        Object.assign(beforeUser, updateData);
        const updatedUser = await manager.save(User, beforeUser);

        // 추천인 변경 시
        if (isRecommenderChanged) {
          await this.userClosureService.moveNode(
            manager,
            updatedUser.userId,
            updatedUser.recommenderId,
          );
        }

        // 트랜잭션 내에서 비밀번호 히스토리 저장 (비밀번호가 변경된 경우에만)
        if (dto.password) {
          await this.userPasswordService.savePasswordHistory(
            manager,
            updatedUser.userId,
            updatedUser.password,
          );
        }

        if (
          dto.positionId !== undefined &&
          dto.positionId !== originalPositionId
        ) {
          const historyRepo = manager.getRepository(UserPositionHistory);
          const history = historyRepo.create({
            userId: updatedUser.userId,
            previousPositionId: originalPositionId,
            newPositionId: updatedUser.positionId,
            changeSource: 'USER_MANAGEMENT', // '사용자 관리' 메뉴에서 수동 변경
            changedByUserId: req?.user?.sub,
          });
          await historyRepo.save(history);
        }

        return updatedUser;
      },
    ); // 트랜잭션 종료

    return plainToInstance(UserResponseDto, updatedUserResult);
  }

  /**
   * 사용자 비활성화
   * @param userId
   * @param req
   * @returns
   */
  async toggleActive(userId: number, req?: AuthorizedRequest) {
    const before = await this.userRepository.findOne({
      where: { userId },
    });

    if (!before) {
      throw new NotFoundException(`사용자를 찾을 수 없습니다.`);
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.userRepository.save(before);
    this.logger.debug(
      `The activation status of ${this.userRepository.metadata.name} ID $${userId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 사용자 삭제(softDelete)
   * @param userId
   * @param req
   */
  async softDelete(userId: number, req?: AuthorizedRequest): Promise<void> {
    const before = await this.userRepository.findOne({
      where: { userId },
    });
    if (!before)
      throw new NotFoundException(
        `${this.userRepository.metadata.name} ID ${userId} is not found.`,
      );

    Object.assign(before, {
      isActive: false,
      updatedAt: new Date(),
      updatedBy: req?.user?.sub,
    });

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    await this.userRepository.save(before);

    await this.userRepository.softDelete(userId);
    this.logger.debug(
      `${this.userRepository.metadata.name} ID $${userId} is deleted.`,
    );
  }

  /**
   * 사용자 복원
   * @param userId
   * @param req
   * @returns
   */
  async restore(userId: number, req?: AuthorizedRequest) {
    const before = await this.userRepository.findOne({
      where: { userId },
      withDeleted: true,
    });

    if (!before)
      throw new NotFoundException(
        `${this.userRepository.metadata.name} ID ${userId} is not found.`,
      );

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = true;
    before.deletedAt = undefined;
    before.updatedBy = req?.user?.sub as number;

    await this.userRepository.restore(userId);
    this.logger.debug(
      `${this.userRepository.metadata.name} ID $${userId} is restored.`,
    );
    return this.userRepository.save(before);
  }

  /**
   * 전체 조회 (삭제된 사용자 포함)
   * @param includeDeleted
   * @param pagination
   * @returns
   */
  async findAllUser(): Promise<UserResponseDto[]> {
    const result = await super.findAll({
      order: { userId: 'ASC' },
      relations: ['position', 'department', 'recommender'],
      withDeleted: true,
    });

    return plainToInstance(UserResponseDto, result);
  }

  /**
   * 상세 조회 (삭제된 데이터는 기본적으로 자동 제외)
   */
  async findOneById(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { userId },
      relations: ['department', 'position'],
    });
    if (!user) throw new NotFoundException(`User ID ${userId} not found`);
    return plainToInstance(UserResponseDto, user);
  }

  /**
   * 하위 추천 계보도 조회
   * @param currentUserId 현재 사용자 ID
   * @param maxDepth 조회할 최대 깊이 (0=본인만, 1=본인+1단계, 10=본인+10단계)
   * @returns
   */
  async findGenealogyTree(
    currentUserId: number,
    maxDepth: number = 10,
  ): Promise<UserGenealogyNodeDto[]> {
    // 1. 루트 사용자(본인) 정보 조회
    const rootUser = await this.userRepository.findOne({
      where: { userId: currentUserId, deletedAt: IsNull() },
      relations: ['position'],
    });

    if (!rootUser) {
      return [];
    }

    type TreeNode = UserGenealogyNodeDto;

    // 루트 노드 생성 (Depth 0)
    const rootNode: TreeNode = {
      key: String(rootUser.userId),
      expanded: true,
      data: {
        userId: rootUser.userId,
        userNm: rootUser.userNm,
        loginId: rootUser.loginId,
        depth: 0,
        position: plainToInstance(PositionResponseDto, rootUser.position),
      },
      children: [],
    };

    // 1-1. [수정] maxDepth가 0이면 본인 노드만 반환 (대시보드용)
    if (maxDepth === 0) {
      return [rootNode];
    }

    // 1-2. [수정] maxDepth가 1 이상이면 하위 노드 조회 (모달용)
    const descendants = await this.closureRepository
      .createQueryBuilder('closure')
      .select(['closure.descendantId AS "userId"', 'closure.depth AS "depth"'])
      .where('closure.ancestorId = :currentUserId', { currentUserId })
      .andWhere('closure.depth > 0') // 자기 자신(depth 0) 제외
      .andWhere('closure.depth <= :maxDepth', { maxDepth })
      .getRawMany<{ userId: number; depth: number }>();

    if (descendants.length === 0) {
      return [rootNode]; // 하위가 없으면 루트 노드만 반환
    }

    const descendantIds = descendants.map((d) => d.userId);
    const depthMap = new Map(descendants.map((d) => [d.userId, d.depth]));

    // 2. 하위 노드 사용자들의 상세 정보
    const users = await this.userRepository.find({
      where: {
        userId: In(descendantIds),
        deletedAt: IsNull(),
      },
      relations: ['position'],
      select: ['userId', 'userNm', 'loginId', 'recommenderId', 'position'],
    });

    // 3. 트리 재구성
    const map = new Map<number, TreeNode>();
    map.set(rootNode.data.userId, rootNode); // 맵에 루트 노드 추가

    // Map에 모든 하위 노드 생성
    for (const user of users) {
      const depth = depthMap.get(user.userId) || 0;
      const node: TreeNode = {
        key: String(user.userId),
        expanded: true,
        data: {
          userId: user.userId,
          userNm: user.userNm,
          loginId: user.loginId,
          depth: depth,
          position: plainToInstance(PositionResponseDto, user.position),
        },
        children: [],
      };
      map.set(user.userId, node);
    }

    // 부모-자식 관계 연결
    for (const user of users) {
      const node = map.get(user.userId);
      if (!node) continue;

      // 부모가 map 안에 있는 경우 (루트 또는 다른 하위 노드)
      if (user.recommenderId && map.has(user.recommenderId)) {
        map.get(user.recommenderId)!.children.push(node);
      }
      // (그 외: 부모가 10단계를 벗어났거나, 삭제된 경우 -> 고아 노드 -> 무시)
    }

    return [rootNode]; // 항상 루트 노드를 포함하는 배열 반환
  }

  /**
   * 사용자 검색 (keyword + 상세조건)
   */
  async search(
    query: SearchUserDto & { page?: number; limit?: number },
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { keyword, deptName, positionName, isActive } = query;
    const { skip, take, page, limit } = getPaginationParams(query);

    const qb = await this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'dept')
      .leftJoinAndSelect('user.position', 'pos')
      .where('1=1');
    if (keyword?.trim()) {
      qb.andWhere(
        '(user.user_nm LIKE :kw OR user.login_Id LIKE :kw OR user.email LIKE :kw)',
        {
          kw: `%${keyword.trim()}%`,
        },
      );
    }
    if (deptName?.trim())
      qb.andWhere('dept.dept_nm LIKE :deptName', {
        deptName: `%${deptName.trim()}%`,
      });
    if (positionName?.trim())
      qb.andWhere('pos.position_nm LIKE :posName', {
        posName: `%${positionName.trim()}%`,
      });
    if (isActive !== undefined)
      qb.andWhere('user.is_active = :isActive', { isActive });

    const [users, total] = await qb
      .skip(skip)
      .take(take)
      .orderBy('user.user_id', 'DESC')
      .getManyAndCount();

    return {
      data: plainToInstance(UserResponseDto, users),
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  /**
   * 로그인용: loginId로 조회
   */
  async findByLoginIdForAuth(loginId: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password') // 비번 명시적 포함
      .where('user.login_id = :loginId', { loginId })
      .andWhere('user.deleted_at IS NULL')
      .getOne();
  }

  /**
   *  최근 로그인 정보 업데이트
   * */
  async updateLastLogin(userId: number, ip?: string, agent?: string) {
    await this.userRepository.save({
      userId,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      lastLoginAgent: agent,
      failCount: 0,
    });
    this.logger.debug(`===> 최근 로그인 정보 갱신: ${userId} / ${ip}`);
  }

  // 로그인 실패 횟수 증가 + 필요시 비활성화
  async increaseFailCountAndMaybeDeactivate(userId: number) {
    if (!this.configService.get<boolean>('security.isFailCountPolicyEnabled')) {
      return;
    }
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) return;
    user.failCount = (user.failCount ?? 0) + 1;
    const maxFailCount = this.configService.get<number>(
      'security.maxFailCount',
    ) as number;
    if (user.failCount >= maxFailCount) {
      user.isActive = false;
    }
    await this.userRepository.save(user);
  }

  /**
   * 사용자 권한 가져오기
   * @param userId
   * @returns
   */
  async getAllRoleInfo(userId: number) {
    const user = (await this.userRepository.findOne({
      where: { userId },
      relations: [
        'userRoles.role', // tb_user_role_map
        'position.positionRoles.role', // tb_position_role_map
      ],
    })) as User;

    const userRoles = user.userRoles?.map((ur) => ur.role) ?? [];
    const positionRoles =
      user.position?.positionRoles?.map((pr) => pr.role) ?? [];

    const uniqueRoles = Array.from(
      new Map([...userRoles, ...positionRoles].map((r) => [r.roleId, r])),
    ).map(([_, role]) => ({
      roleId: role.roleId,
      roleCd: role.roleCd,
      roleNm: role.roleNm,
    }));

    return uniqueRoles;
  }

  /**
   * 트랜잭션으로 직급 변경과 이력('PROMOTION_SYSTEM')을 기록합니다.
   * @param userId
   * @param newPositionId
   * @param adminUserId
   * @returns
   */
  async promoteUserPosition(
    userId: number,
    newPositionId: number,
    adminUserId: number,
  ) {
    // 👇 [수정] this.dataSource.transaction -> this.userRepository.manager.transaction
    return this.userRepository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const historyRepo = manager.getRepository(UserPositionHistory);
      const positionRepo = manager.getRepository(Position);

      // ... (이하 로직은 모두 동일)
      const user = await userRepo.findOneBy({ userId });
      if (!user) throw new NotFoundException('User not found');

      const newPosition = await positionRepo.findOneBy({
        positionId: newPositionId,
      });
      if (!newPosition) throw new NotFoundException('New position not found');

      const originalPositionId = user.positionId;

      user.positionId = newPositionId;
      user.updatedBy = adminUserId;
      await userRepo.save(user);

      const history = historyRepo.create({
        userId: userId,
        previousPositionId: originalPositionId,
        newPositionId: newPositionId,
        changeSource: 'PROMOTION_SYSTEM',
        changedByUserId: adminUserId,
      });
      await historyRepo.save(history);

      return user;
    });
  }

  async countActiveUsersByDeptId(deptId: number): Promise<number> {
    return this.userRepository.count({
      where: {
        deptId: deptId,
        deletedAt: IsNull(),
      },
    });
  }

  // 특정 직급의 (삭제되지 않은) 활성 사용자 수 계산
  async countActiveUsersByPositionId(positionId: number): Promise<number> {
    return this.userRepository.count({
      where: {
        positionId: positionId,
        deletedAt: IsNull(),
      },
    });
  }

  async extendPasswordExpiry(userId: number) {
    await this.userRepository.update(
      { userId },
      { passwordChangedAt: new Date() }, // 현재 시간으로 업데이트하여 수명 연장
    );
  }
}
