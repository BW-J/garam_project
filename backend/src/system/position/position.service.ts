import {
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Position } from 'src/core/entities/tb_position.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { SearchPositionDto } from './dto/search-position.dto';
import { PositionResponseDto } from './dto/Position-response.dto';
import { plainToInstance } from 'class-transformer';
import { BaseService } from 'src/core/services/base.service';
import { AuthorizedRequest } from 'src/types/http';
import { UserService } from '../user/user.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class PositionService extends BaseService<Position> {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(positionRepository);
  }

  /**
   * 직급 코드(SFP, DIRECTOR 등) 캐시를 지우는 헬퍼
   */
  private async clearPositionCache(positionCd: string | null) {
    if (positionCd) {
      const cacheKey = `pos_id:${positionCd}`;
      await this.cacheManager.del(cacheKey);
      this.logger.log(`Cache cleared for key: ${cacheKey}`);
    }
  }

  /**
   * 직급 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createPosition(
    dto: CreatePositionDto,
    currentUserId: number,
  ): Promise<PositionResponseDto> {
    await this.validatePosition(null, dto.positionCd, dto.positionNm);
    const entity = this.positionRepository.create(dto);
    const result = await super.create(entity, currentUserId);

    return plainToInstance(PositionResponseDto, result);
  }

  /**
   * 직급 수정
   * @param positionId
   * @param dto
   * @param req
   * @returns
   */
  async updatePosition(
    positionId: number,
    dto: UpdatePositionDto,
    req?: AuthorizedRequest,
  ) {
    await this.validatePosition(dto.positionId, dto.positionCd, dto.positionNm);
    const result = await super.updateForKey('positionId', positionId, dto, req);
    // 수정 시 캐시 삭제
    await this.clearPositionCache(result.positionCd);
    await this.clearPositionCache(dto.positionCd);
    return plainToInstance(PositionResponseDto, result);
  }

  /**
   * 직급 비활성화
   * @param positionId
   * @param req
   * @returns
   */
  async toggleActive(positionId: number, req?: AuthorizedRequest) {
    const before = await this.positionRepository.findOne({
      where: { positionId },
    });

    if (!before) {
      throw new NotFoundException(`직급을 찾을 수 없습니다.`);
    }

    if (before.isActive) {
      // 1. [신규] 하위 '활성 사용자'가 있는지 검사
      const activeUserCount =
        await this.userService.countActiveUsersByPositionId(positionId);
      if (activeUserCount > 0) {
        throw new BadRequestException(
          `활성 사용자가 ${activeUserCount}명 소속되어 있어 비활성화할 수 없습니다.`,
        );
      }
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.positionRepository.save(before);

    // 토글 시 캐시 삭제
    await this.clearPositionCache(result.positionCd);

    this.logger.debug(
      `The activation status of ${this.positionRepository.metadata.name} ID $${positionId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 직급 전체 조회
   * @returns
   */
  async findAllPosition(): Promise<PositionResponseDto[]> {
    const result = await super.findAll({
      order: { sortOrder: 'ASC', positionId: 'ASC' },
    });
    return plainToInstance(PositionResponseDto, result);
  }

  /**
   * 직급 단건 조회
   * @param positionId
   * @returns
   */
  async findOnePosition(positionId: number): Promise<PositionResponseDto> {
    const result = await this.positionRepository.findOne({
      where: { positionId, isActive: true },
    });
    if (!result) throw new NotFoundException(`직급을 찾을 수 없습니다.`);
    return plainToInstance(PositionResponseDto, result);
  }

  // 검색 기능 (동적 조건)
  // 혹시 몰라 남겨둠
  async search(params: SearchPositionDto): Promise<Position[]> {
    const qb = this.positionRepository.createQueryBuilder('pos');

    if (params.positionCd) {
      qb.andWhere('pos.position_cd ILIKE :positionCd', {
        positionCd: `%${params.positionCd}%`,
      });
    }

    if (params.positionNm) {
      qb.andWhere('pos.position_nm ILIKE :positionNm', {
        positionNm: `%${params.positionNm}%`,
      });
    }

    if (params.isActive !== undefined) {
      qb.andWhere('pos.is_active = :isActive', { isActive: params.isActive });
    }

    qb.orderBy('pos.sort_order', 'ASC').addOrderBy('pos.position_id', 'ASC');

    return qb.getMany();
  }

  async validatePosition(
    positionId: number | null,
    positionCd: string | null,
    positionNm: string,
  ) {
    // 1. potosionCd 중복 체크 (자신 제외)
    const codeWhere: any = { positionCd: positionCd };
    if (positionId !== null) {
      codeWhere.positionId = Not(positionId); // 수정 시: 자신을 제외
    }

    const codeExists = await this.positionRepository.exist({
      where: codeWhere,
    });
    if (codeExists) {
      throw new ConflictException(
        `직급 코드(${positionCd})가 이미 사용 중입니다.`,
      );
    }

    // 2. positionNm 중복 체크 (자신 제외)
    const nameWhere: any = { positionNm: positionNm };
    if (positionId !== null) {
      nameWhere.positionId = Not(positionId); // 수정 시: 자신을 제외
    }

    const nameExists = await this.positionRepository.exist({
      where: nameWhere,
    });
    if (nameExists) {
      throw new ConflictException(
        `동일한 직급(${positionNm})이 이미 존재 합니다.`,
      );
    }
  }
}
