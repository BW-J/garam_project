import { InjectRepository } from '@nestjs/typeorm';
import { CreateActionDto } from './dto/create-action.dto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseService } from 'src/core/services/base.service';
import { Action } from 'src/core/entities/tb_action.entity';
import { Not, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { actionResponseDto } from './dto/Action-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import { UpdateActionDto } from './dto/update-action.dto';
import { SearchActionDto } from './dto/search-action.dto';

@Injectable()
export class ActionService extends BaseService<Action> {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {
    super(actionRepository);
  }

  /**
   * 행동 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createAction(dto: CreateActionDto, currentUserId: number) {
    await this.validateAction(null, dto.actionCd, dto.actionNm);
    const entity = this.actionRepository.create(dto);
    const result = await super.create(entity, currentUserId);

    return plainToInstance(actionResponseDto, result);
  }

  /**
   * 행동 수정
   * @param actionId
   * @param dto
   * @param req
   * @returns
   */
  async updateAction(
    actionId: number,
    dto: UpdateActionDto,
    req?: AuthorizedRequest,
  ) {
    await this.validateAction(dto.actionId, dto.actionCd, dto.actionNm);

    const result = await super.updateForKey('actionId', actionId, dto, req);
    return plainToInstance(actionResponseDto, result);
  }

  /**
   * 행동 비활성화
   * @param actionId
   * @param req
   * @returns
   */
  async toggleActive(actionId: number, req?: AuthorizedRequest) {
    const before = await this.actionRepository.findOne({
      where: { actionId },
    });

    if (!before) {
      throw new NotFoundException(`행동을 찾을 수 없습니다.`);
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.actionRepository.save(before);
    this.logger.debug(
      `The activation status of ${this.actionRepository.metadata.name} ID $${actionId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 행동 전체 조회
   * @returns
   */
  async findAllaction(): Promise<actionResponseDto[]> {
    const result = await super.findAll({
      order: { actionId: 'ASC' },
    });

    return plainToInstance(actionResponseDto, result);
  }

  /**
   * 행동 단건 조회
   * @param actionId
   * @returns
   */
  async findOneAction(actionId: number): Promise<actionResponseDto> {
    const result = await this.actionRepository.findOne({
      where: { actionId, isActive: true },
    });
    if (!result) throw new NotFoundException(`행동을 찾을 수 없습니다.`);
    return plainToInstance(actionResponseDto, result);
  }

  // 검색 기능 (동적 조건)
  // 혹시 몰라 남겨둠
  async search(params: SearchActionDto): Promise<Action[]> {
    const qb = this.actionRepository.createQueryBuilder('action');

    if (params.actionCd) {
      qb.andWhere('action.action_cd ILIKE :actionCd', {
        actionCd: `%${params.actionCd}%`,
      });
    }

    if (params.actionNm) {
      qb.andWhere('action.action_nm ILIKE :actionNm', {
        actionNm: `%${params.actionNm}%`,
      });
    }

    if (params.isActive !== undefined) {
      qb.andWhere('action.is_active = :isActive', {
        isActive: params.isActive,
      });
    }

    qb.orderBy('action.action_id', 'ASC');

    return qb.getMany();
  }

  async validateAction(
    actionId: number | null,
    actionCd: string,
    actionNm: string,
  ) {
    // 1. actionCd 중복 체크 (자신 제외)
    const codeWhere: any = { actionCd: actionCd };
    if (actionId !== null) {
      codeWhere.actionId = Not(actionId); // 수정 시: 자신을 제외
    }

    const codeExists = await this.actionRepository.exist({ where: codeWhere });
    if (codeExists) {
      throw new ConflictException(
        `행동 코드(${actionCd})가 이미 사용 중입니다.`,
      );
    }

    // 3. actionNm 중복 체크 (자신 제외)
    const actionWhere: any = { actionNm: actionNm };
    if (actionId !== null) {
      actionWhere.actionId = Not(actionId); // 수정 시: 자신을 제외
    }

    const actionExists = await this.actionRepository.exist({
      where: actionWhere,
    });
    if (actionExists) {
      throw new ConflictException(
        `동일한 행동명(${actionNm})이 이미 존재 합니다.`,
      );
    }
  }
}
