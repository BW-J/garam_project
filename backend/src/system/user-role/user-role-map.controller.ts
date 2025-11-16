import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { UserRoleMapService } from './user-role-map.service';
import { Activity } from 'src/common/decorators/activity.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SetUserRolesDto } from './dto/set-user-role.dto';
import { Permission } from 'src/common/decorators/permession.decorator';
import type { AuthorizedRequest } from 'src/types/http';

@Controller('system/user-role')
@AuditEntity('USER_ROLE_MAP')
@AuditKey('userNm')
export class UserRoleMapController {
  constructor(private readonly service: UserRoleMapService) {}

  /**
   * 사용자 권한 조회
   * @param userId
   * @returns
   */

  @Permission('ASSIGN_MGMT', 'VIEW')
  @Get(':userId')
  @Activity('사용자 권한 조회')
  async getUserRoles(@Param('userId') userId: number) {
    return this.service.getRolesByUser(userId);
  }

  /**
   * 사용자 권한 설정
   * @param userId
   * @param dto
   * @param user
   * @returns
   */
  @Permission('ASSIGN_MGMT', 'CREATE')
  @Activity('사용자 권한 설정')
  @Post(':userId')
  async setUserRoles(
    @Param('userId') userId: number,
    @Body() dto: SetUserRolesDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.service.setUserRoles(userId, dto.roleIds, req);
  }
}
