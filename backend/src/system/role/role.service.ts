import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/core/entities/tb_role.entity';
import { BaseService } from 'src/core/services/base.service';
import { Not, Repository } from 'typeorm';
import { SearchRoleDto } from './dto/search-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { plainToInstance } from 'class-transformer';
import { RoleResponseDto } from './dto/Role-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService extends BaseService<Role> {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {
    super(roleRepository);
  }

  /**
   * 역할 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createRole(dto: CreateRoleDto, currentUserId: number) {
    await this.validateRole(null, dto.roleCd, dto.roleNm);
    const entity = this.roleRepository.create(dto);
    const result = await super.create(entity, currentUserId);

    return plainToInstance(RoleResponseDto, result);
  }

  /**
   * 역할 수정
   * @param roleId
   * @param dto
   * @param req
   * @returns
   */
  async updateRole(
    roleId: number,
    dto: UpdateRoleDto,
    req?: AuthorizedRequest,
  ) {
    await this.validateRole(dto.roleId, dto.roleCd, dto.roleNm);

    const result = await super.updateForKey('roleId', roleId, dto, req);
    return plainToInstance(RoleResponseDto, result);
  }

  /**
   * 행동 비활성화
   * @param roleId
   * @param req
   * @returns
   */
  async toggleActive(roleId: number, req?: AuthorizedRequest) {
    const before = await this.roleRepository.findOne({
      where: { roleId },
    });

    if (!before) {
      throw new NotFoundException(`행동을 찾을 수 없습니다.`);
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.roleRepository.save(before);
    this.logger.debug(
      `The activation status of ${this.roleRepository.metadata.name} ID $${roleId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 역할 전체 조회
   * @returns
   */
  async findAllRole(): Promise<RoleResponseDto[]> {
    const result = await super.findAll({
      order: { roleId: 'ASC' },
    });

    return plainToInstance(RoleResponseDto, result);
  }

  /**
   * 역할 단건 조회
   * @param roleId
   * @returns
   */
  async findOneRole(roleId: number): Promise<RoleResponseDto> {
    const result = await this.roleRepository.findOne({
      where: { roleId, isActive: true },
    });
    if (!result) throw new NotFoundException(`역할을 찾을 수 없습니다.`);
    return plainToInstance(RoleResponseDto, result);
  }

  // 검색 기능 (동적 조건)
  // 혹시 몰라 남겨둠
  async search(params: SearchRoleDto): Promise<Role[]> {
    const qb = this.roleRepository.createQueryBuilder('role');

    if (params.roleCd) {
      qb.andWhere('role.role_cd ILIKE :roleCd', {
        roleCd: `%${params.roleCd}%`,
      });
    }

    if (params.roleNm) {
      qb.andWhere('role.role_nm ILIKE :roleNm', {
        roleNm: `%${params.roleNm}%`,
      });
    }

    if (params.isActive !== undefined) {
      qb.andWhere('role.is_active = :isActive', { isActive: params.isActive });
    }

    qb.orderBy('role.sort_order', 'ASC').addOrderBy('role.role_id', 'ASC');

    return qb.getMany();
  }

  async validateRole(
    roleId: number | null,
    roleCd: string | null,
    roleNm: string,
  ) {
    // 1. potosionCd 중복 체크 (자신 제외)
    const codeWhere: any = { roleCd: roleCd };
    if (roleId !== null) {
      codeWhere.roleId = Not(roleId); // 수정 시: 자신을 제외
    }

    const codeExists = await this.roleRepository.exist({ where: codeWhere });
    if (codeExists) {
      throw new ConflictException(`역할 코드(${roleCd})가 이미 사용 중입니다.`);
    }

    // 2. roleNm 중복 체크 (자신 제외)
    const nameWhere: any = { roleNm: roleNm };
    if (roleId !== null) {
      nameWhere.roleId = Not(roleId); // 수정 시: 자신을 제외
    }

    const nameExists = await this.roleRepository.exist({ where: nameWhere });
    if (nameExists) {
      throw new ConflictException(
        `동일한 역할명(${roleNm})이 이미 존재 합니다.`,
      );
    }
  }
}
