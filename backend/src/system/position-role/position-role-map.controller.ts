import { Controller, Get, Param, Post, Body, Req } from '@nestjs/common';
import { Activity } from 'src/common/decorators/activity.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { SetPositionRolesDto } from './dto/set-position-role.dto';
import { PositionRoleMapService } from './position-role-map.service';
import { Permission } from 'src/common/decorators/permession.decorator';
import type { AuthorizedRequest } from 'src/types/http';

@Controller('system/position-role')
@AuditEntity('POSITION_ROLE_MAP')
@AuditKey('positionNm')
export class PositionRoleMapController {
  constructor(private readonly Positionservice: PositionRoleMapService) {}

  /**
   * 직급 권한 조회
   * @param positionId
   * @returns
   */
  @Permission('ASSIGN_MGMT', 'VIEW')
  @Get(':positionId')
  @Activity('직급권한 조회')
  async getPositionRoles(@Param('positionId') positionId: number) {
    return this.Positionservice.getRolesByPosition(positionId);
  }

  /**
   * 직급 권한 설정
   * @param positionId
   * @param dto
   * @param user
   * @returns
   */
  @Permission('ASSIGN_MGMT', 'CREATE')
  @Activity('직급권한 설정')
  @Post(':positionId')
  async setPositionRoles(
    @Param('positionId') positionId: number,
    @Body() dto: SetPositionRolesDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.Positionservice.setPositionRoles(positionId, dto.roleIds, req);
  }
}
