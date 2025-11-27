import {
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { PromotionService } from './promotion.service';
import { PromoteBatchDto } from './dto/promote-batch.dto';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { PositionCode } from 'src/common/constants/position-code.enum';

@AuditEntity('PROMOTION')
@AuditKey('userId')
@Controller('system/promotion')
// (참고: 전역 가드가 설정되어 있으므로 @UseGuards 생략)
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * 승진 대상자 목록 및 조건 충족 여부 조회
   * GET /api/system/promotion/candidates?targetPosition=MANAGER
   */
  @Get('candidates')
  @Permission('PROMOTION_MGMT', 'VIEW') // (신규 권한 코드 'PROMOTION_MGMT' 필요)
  @Activity('승진 대상자 조회')
  async getCandidates(@Query('targetPosition') targetPosition: string) {
    let targetEnum: PositionCode;

    if (targetPosition === 'MANAGER') {
      targetEnum = PositionCode.MANAGER;
    } else if (targetPosition === 'DIRECTOR') {
      targetEnum = PositionCode.DIRECTOR;
    } else {
      throw new BadRequestException('Invalid target position');
    }
    return this.promotionService.getPromotionCandidates(targetEnum);
  }

  /**
   * 사용자 일괄 승진 실행
   * POST /api/system/promotion/promote/batch
   */
  @Post('promote/batch')
  @Permission('PROMOTION_MGMT', 'UPDATE')
  @Activity('사용자 일괄 승진 처리')
  async promoteBatch(
    @Body() dto: PromoteBatchDto,
    @CurrentUser() adminUser: any,
  ) {
    return this.promotionService.promoteBatch(dto.userIds, adminUser.sub);
  }

  /**
   * 사용자 승진 실행
   * POST /api/system/promotion/promote/:userId
   */
  @Post('promote/:userId')
  @Permission('PROMOTION_MGMT', 'UPDATE')
  @Activity('사용자 승진 처리')
  async promoteUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() adminUser: any,
  ) {
    return this.promotionService.promoteUser(userId, adminUser.sub);
  }
}
