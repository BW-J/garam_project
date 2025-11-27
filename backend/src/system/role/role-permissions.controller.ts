import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { RolePermissionsService } from './role-permission.service';
import { Activity } from 'src/common/decorators/activity.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import type { AuthorizedRequest } from 'src/types/http';

type PermissionStateMap = Record<string, string[]>;

@AuditEntity('ROLE_PERMISSIONS')
@AuditKey('roleId')
@Controller('system/role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  /**
   * 역할 권한 조회 (UI용 Map 형식)
   * @param roleId
   * @returns
   */
  @Permission('ROLE_MGMT', 'VIEW')
  @Activity('역할 권한 맵 조회')
  @Get('map/:roleId')
  async getRolePermissionMap(
    @Param('roleId') roleId: number,
  ): Promise<PermissionStateMap> {
    return this.rolePermissionsService.getRolePermissionMap(roleId);
  }

  /**
   * 역할 권한 설정 (UI용 Map 형식)
   * @param roleId
   * @param permissionsMap
   * @param user
   * @returns
   */
  @Permission('ROLE_MGMT', 'UPDATE')
  @Activity('역할 권한 맵 설정')
  @Put('map/:roleId') //
  async setRolePermissionMap(
    @Param('roleId') roleId: number,
    @Body() permissionsMap: PermissionStateMap,
    @Req() req: AuthorizedRequest,
  ) {
    return this.rolePermissionsService.setRolePermissionMap(
      roleId,
      permissionsMap,
      req,
    );
  }

  /**
   * 역할 권한 조회
   * @param roleId
   * @returns
   */
  @Permission('ROLE_MGMT', 'VIEW')
  @Activity('역할 권한 조회')
  @Get(':roleId')
  async getRolePermissions(@Param('roleId') roleId: number) {
    return this.rolePermissionsService.getRolePermissions(roleId);
  }

  /**
   * 역할 권한 설정
   * @param roleId
   * @param permissions
   * @param user
   * @returns
   */
  @Permission('ROLE_MGMT', 'UPDATE')
  @Activity('역활 권한 설정')
  @Post(':roleId')
  async setRolePermissions(
    @Param('roleId') roleId: number,
    @Body()
    permissions: { menuId: number; actionId: number; isActive: boolean }[],
    @CurrentUser() user: any,
  ) {
    return this.rolePermissionsService.setRolePermissions(
      roleId,
      permissions,
      user.sub,
    );
  }
}
