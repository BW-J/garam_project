import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Req,
  Delete,
  Query,
} from '@nestjs/common';
import { Activity } from 'src/common/decorators/activity.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Menu } from 'src/core/entities/tb_menu.entity';
import type { AuthorizedRequest } from 'src/types/http';
import { CreateMenuDto } from './dto/create-menu.dto';
import { MenuResponseDto } from './dto/Menu-response.dto';
import { SearchMenuDto } from './dto/search-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuService } from './menu.service';
import { Permission } from 'src/common/decorators/permession.decorator';

@AuditEntity('MENU')
@AuditKey('menuNm')
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * 메뉴 조회
   * @returns
   */
  @Activity('메뉴 조회')
  @Permission('RESOURCE_MGMT', 'VIEW')
  @Get()
  async findAllMenu(): Promise<MenuResponseDto[]> {
    return this.menuService.findAllMenu();
  }

  /**
   * 메뉴 단건 조회
   * @param id
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'VIEW')
  @Activity('메뉴 단건 조회')
  @Get('id/:menuId')
  async findOnemenu(@Param('menuId') id: number): Promise<MenuResponseDto> {
    return this.menuService.findOneMenu(id);
  }

  /**
   * 메뉴 생성
   * @param dto
   * @param user
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'CREATE')
  @Activity('메뉴 생성')
  @Post()
  async create(
    @Body() dto: CreateMenuDto,
    @CurrentUser() user: any,
  ): Promise<MenuResponseDto> {
    return this.menuService.createMenu(dto, user.sub);
  }

  /**
   * 메뉴 수정
   * @param menuId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'UPDATE')
  @Activity('메뉴 수정')
  @Patch(':menuId')
  async update(
    @Param('menuId') menuId: number,
    @Body() dto: UpdateMenuDto,
    @Req() req: AuthorizedRequest,
  ): Promise<MenuResponseDto> {
    return this.menuService.updateMenu(menuId, dto, req);
  }

  /**
   * 메뉴 활성화/비활성화
   * @param menuId
   * @param req
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'DELETE')
  @Activity('메뉴 활성화/비활성화')
  @Patch('toggle/:menuId')
  async toggleActive(
    @Param('menuId') menuId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<Menu> {
    return this.menuService.toggleActive(menuId, req);
  }

  /**
   * 메뉴 삭제
   * 실제 사용은 하지 않으나 일단 구현만 해 둔 상황
   * @param menuId
   * @param req
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'DELETE')
  @Activity('메뉴 삭제')
  @Delete(':menuId')
  async remove(
    @Param('menuId') menuId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.menuService.hardDelete(menuId, req);
    return { message: 'menu successfully deleted' };
  }

  //  검색 기능
  // 혹시몰라 남겨둠
  @Get('search')
  async search(@Query() query: SearchMenuDto): Promise<MenuResponseDto[]> {
    return this.menuService.search(query);
  }
}
