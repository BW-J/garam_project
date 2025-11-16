import { InjectRepository } from '@nestjs/typeorm';
import { CreateMenuDto } from './dto/create-menu.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseService } from 'src/core/services/base.service';
import { Menu } from 'src/core/entities/tb_menu.entity';
import { DataSource, Not, Repository, TreeRepository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { MenuResponseDto } from './dto/Menu-response.dto';
import { AuthorizedRequest } from 'src/types/http';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SearchMenuDto } from './dto/search-menu.dto';

@Injectable()
export class MenuService extends BaseService<Menu> {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {
    super(menuRepository);
  }

  /**
   * 메뉴 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createMenu(dto: CreateMenuDto, currentUserId: number) {
    await this.validateMenu(null, dto.menuCd, dto.menuNm, dto.parentMenuId);
    const entity = this.menuRepository.create(dto);
    const result = await super.create(entity, currentUserId);

    return plainToInstance(MenuResponseDto, result);
  }

  /**
   * 메뉴 수정
   * @param menuId
   * @param dto
   * @param req
   * @returns
   */
  async updateMenu(
    menuId: number,
    dto: UpdateMenuDto,
    req?: AuthorizedRequest,
  ) {
    await this.validateMenu(
      dto.menuId,
      dto.menuCd,
      dto.menuNm,
      dto.parentMenuId,
    );

    const result = await super.updateForKey('menuId', menuId, dto, req);
    return plainToInstance(MenuResponseDto, result);
  }

  /**
   * 메뉴 비활성화
   * @param menuId
   * @param req
   * @returns
   */
  async toggleActive(menuId: number, req?: AuthorizedRequest) {
    const before = await this.menuRepository.findOne({
      where: { menuId },
      relations: ['children'],
    });

    if (!before) {
      throw new NotFoundException(`메뉴를 찾을 수 없습니다.`);
    }

    if (before.isActive && before.children.length > 0) {
      throw new BadRequestException(
        '하위 메뉴가 존재하여 삭제할 수 없습니다. 하위 메뉴를 먼저 처리해 주세요.',
      );
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.menuRepository.save(before);
    this.logger.debug(
      `The activation status of ${this.menuRepository.metadata.name} ID $${menuId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 메뉴 전체 조회
   * @returns
   */
  async findAllMenu(): Promise<MenuResponseDto[]> {
    const result = await this.menuRepository.find({
      order: { sortOrder: 'ASC', menuId: 'ASC' },
      relations: ['parent'],
    });
    return plainToInstance(MenuResponseDto, result);
  }

  /**
   * 메뉴 단건 조회
   * @param menuId
   * @returns
   */
  async findOneMenu(menuId: number): Promise<MenuResponseDto> {
    const result = await this.menuRepository.findOne({
      where: { menuId, isActive: true },
    });
    if (!result) throw new NotFoundException(`메뉴을 찾을 수 없습니다.`);
    return plainToInstance(MenuResponseDto, result);
  }

  // 검색 기능 (동적 조건)
  // 혹시 몰라 남겨둠
  async search(params: SearchMenuDto): Promise<Menu[]> {
    const qb = this.menuRepository.createQueryBuilder('menu');

    if (params.menuCd) {
      qb.andWhere('menu.menu_cd ILIKE :menuCd', {
        menuCd: `%${params.menuCd}%`,
      });
    }

    if (params.menuNm) {
      qb.andWhere('menu.menu_nm ILIKE :menuNm', {
        menuNm: `%${params.menuNm}%`,
      });
    }

    if (params.isActive !== undefined) {
      qb.andWhere('menu.is_active = :isActive', { isActive: params.isActive });
    }

    qb.orderBy('menu.sort_order', 'ASC').addOrderBy('menu.menu_id', 'ASC');

    return qb.getMany();
  }

  async validateMenu(
    menuId: number | null,
    menuCd: string | null,
    menuNm: string,
    parentMenuId: number | null,
  ) {
    // 1. 상위 부서 활성 상태 및 유효성 체크
    if (parentMenuId !== null) {
      const parent = await this.menuRepository.findOne({
        where: { menuId: parentMenuId },
        select: ['menuId', 'isActive'], // 필요한 필드만 조회
      });

      if (!parent) {
        throw new BadRequestException(
          '지정한 상위 부서 ID가 존재하지 않습니다.',
        );
      }
      if (!parent.isActive) {
        throw new BadRequestException(
          '상위 부서가 비활성 상태이므로 하위 부서를 만들 수 없습니다.',
        );
      }
    }
    // 2. menuCd 중복 체크 (자신 제외)
    const codeWhere: any = { menuCd: menuCd };
    if (menuId !== null) {
      codeWhere.menuId = Not(menuId); // 수정 시: 자신을 제외
    }

    const codeExists = await this.menuRepository.exist({ where: codeWhere });
    if (codeExists) {
      throw new ConflictException(`메뉴 코드(${menuCd})가 이미 사용 중입니다.`);
    }

    // 3. menuNm 중복 체크 (자신 제외)
    const menuWhere: any = { menuNm: menuNm, parentMenuId: parentMenuId };
    if (menuId !== null) {
      menuWhere.menuId = Not(menuId); // 수정 시: 자신을 제외
    }

    const menuExists = await this.menuRepository.exist({ where: menuWhere });
    if (menuExists) {
      throw new ConflictException(
        `동일한 메뉴명(${menuNm})이 이미 존재 합니다.`,
      );
    }
    // 4. [수정 시에만] 순환 참조 체크
    if (menuId !== null && parentMenuId === menuId) {
      throw new BadRequestException('상위 부서는 자기 자신일 수 없습니다.');
    }
  }
}
