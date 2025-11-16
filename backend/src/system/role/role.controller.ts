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
import type { AuthorizedRequest } from 'src/types/http';
import { RoleResponseDto } from './dto/Role-response.dto';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from 'src/core/entities/tb_role.entity';
import { SearchRoleDto } from './dto/search-role.dto';
import { Permission } from 'src/common/decorators/permession.decorator';

@AuditEntity('ROLE')
@AuditKey('roleNm')
@Controller('system/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 역할 조회
   * @returns
   */
  @Permission('ROLE_MGMT', 'VIEW')
  @Activity('역할 조회')
  @Get()
  async findAllRole(): Promise<RoleResponseDto[]> {
    return this.roleService.findAllRole();
  }

  /**
   * 역할 단건 조회
   * @param id
   * @returns
   */
  @Permission('ROLE_MGMT', 'VIEW')
  @Activity('역할 단건 조회')
  @Get('id/:roleId')
  async findOnerole(@Param('roleId') id: number): Promise<RoleResponseDto> {
    return this.roleService.findOneRole(id);
  }

  /**
   * 역할 생성
   * @param dto
   * @param user
   * @returns
   */
  @Permission('ROLE_MGMT', 'CREATE')
  @Activity('역할 생성')
  @Post()
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: any,
  ): Promise<RoleResponseDto> {
    return this.roleService.createRole(dto, user.sub);
  }

  /**
   * 역할 수정
   * @param roleId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('ROLE_MGMT', 'UPDATE')
  @Activity('역할 수정')
  @Patch(':roleId')
  async update(
    @Param('roleId') roleId: number,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthorizedRequest,
  ): Promise<RoleResponseDto> {
    return this.roleService.updateRole(roleId, dto, req);
  }

  /**
   * 역할 활성화/비활성화
   * @param roleId
   * @param req
   * @returns
   */
  @Permission('ROLE_MGMT', 'DELETE')
  @Activity('역할 활성화/비활성화')
  @Patch('toggle/:roleId')
  async toggleActive(
    @Param('roleId') roleId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<Role> {
    return this.roleService.toggleActive(roleId, req);
  }

  /**
   * 역할 삭제
   * 실제 사용은 하지 않으나 일단 구현만 해 둔 상황
   * @param roleId
   * @param req
   * @returns
   */
  @Permission('ROLE_MGMT', 'DELETE')
  @Activity('역할 삭제')
  @Delete(':roleId')
  async remove(
    @Param('roleId') roleId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.roleService.hardDelete(roleId, req);
    return { message: 'role successfully deleted' };
  }

  //  검색 기능
  // 혹시몰라 남겨둠
  @Get('search')
  async search(@Query() query: SearchRoleDto): Promise<RoleResponseDto[]> {
    return this.roleService.search(query);
  }
}
