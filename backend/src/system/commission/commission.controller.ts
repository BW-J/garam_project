import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Patch,
  Param,
  Get,
  Query,
  ParseIntPipe,
  BadRequestException,
  Req,
  Delete,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommissionService } from './commission.service';
import { UploadPerformanceDto } from './dto/upload-performance.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { UpdateIqaDto } from './dto/update-iqa.dto';
import { CalculateCommissionDto } from './dto/calculate-commission.dto';
import { CommissionQueryDto } from './dto/query-commission.dto';
import type { AuthorizedRequest } from 'src/types/http';
import { AdjustCommissionDto } from './dto/adjust-commission.dto';
import { UpdatePerformanceDetailDto } from './dto/update-performance-detail.dto';
import { AdjustPerformanceDto } from './dto/adjust-performance.dto';
@Controller('system/commission')
@AuditEntity('PERFORMANCE') // 감사 로그용
@AuditKey('id')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  /** 1. (관리자) 실적 업로드 */
  @Post('upload')
  @Permission('COMMISSION_MGMT', 'CREATE')
  @Activity('실적 Excel 업로드')
  @UseInterceptors(FileInterceptor('file')) // 'file'은 form-data의 key
  async uploadPerformance(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPerformanceDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.uploadPerformanceData(
      body.yearMonth,
      file,
      user,
    );
  }

  /**
   * 엑셀 다운로드 API
   */
  @Get('download/excel')
  @Permission('COMMISSION_MGMT', 'VIEW')
  @Activity('수당 내역 엑셀 다운로드')
  async downloadExcel(
    @Query('yearMonth') yearMonth: string,
    @Query('commissionType') commissionType: string,
    @Res() res: Response,
  ) {
    if (!yearMonth || !commissionType) {
      throw new BadRequestException('필수 파라미터가 누락되었습니다.');
    }

    const buffer = await this.commissionService.downloadCommissionExcel(
      yearMonth,
      commissionType,
    );

    const fileName = `Commission_${commissionType}_${yearMonth}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  /** 2. (관리자) 실적 iqa 수정 */
  @Patch('performance/:id/iqa')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @AuditEntity('tb_performance')
  @AuditKey('id')
  @Activity('IQA 수정')
  async updateIqa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIqaDto,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.updateIqa(id, dto, user, req);
  }

  /**
   * 실적 상세 내역 수정
   * PATCH /api/system/commission/detail/:detailId
   */
  @Patch('detail/:detailId')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @AuditEntity('tb_performance_detail')
  @AuditKey('detailId')
  @Activity('실적 상세 수정')
  async updateDetail(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: UpdatePerformanceDetailDto,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.updatePerformanceDetail(
      detailId,
      dto,
      user,
      req,
    );
  }

  /**
   * 실적 조정 내역 추가
   * POST /api/system/commission/adjustment
   */
  @Post('adjustment')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @AuditEntity('tb_performance_detail')
  @Activity('실적 조정 추가')
  async addAdjustment(
    @Body() dto: AdjustPerformanceDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.addPerformanceAdjustment(dto, user);
  }

  /**
   * 실적 상세(조정) 내역 삭제
   * DELETE /api/system/commission/detail/:detailId
   */
  @Delete('detail/:detailId')
  @Permission('COMMISSION_MGMT', 'DELETE')
  @AuditEntity('tb_performance_detail')
  @AuditKey('detailId')
  @Activity('실적 상세 삭제')
  async deleteDetail(
    @Param('detailId', ParseIntPipe) detailId: number,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.deletePerformanceDetail(detailId, user, req);
  }

  /** 3. (관리자) 수당 계산 실행 */
  @Post('calculate')
  @Permission('COMMISSION_MGMT', 'CREATE')
  @Activity('수당 계산 실행')
  async calculateCommission(
    @Body() body: CalculateCommissionDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.calculateCommissions(body.yearMonth, user);
  }

  /** (관리자용) 실적 조회 */
  @Get('manage/performance')
  @Permission('COMMISSION_MGMT', 'VIEW')
  @Activity('실적 데이터 조회 (관리)')
  async getPerformanceMngt(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    // 일반 사용자가 자기 ID가 아닌 것을 조회하려 할 때, 서비스에서 권한을 막음
    return this.commissionService.getPerformanceDataForAdmin(query, user.sub);
  }

  /** (관리자용) 수당 상세내역 조회 */
  @Get('manage/history')
  @Permission('COMMISSION_MGMT', 'VIEW')
  @Activity('수당 상세 내역 조회(관리)')
  async getLedgerHistoryMngt(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.getCommissionLedgerHistoryForAdmin(
      query,
      user.sub,
      query.commissionType,
    );
  }

  /**
   * (관리자용) 수당 요약 조회
   * @param query
   * @returns
   */
  @Get('manage/summary')
  @Permission('COMMISSION_MGMT', 'VIEW')
  @Activity('수당 요약 조회 (관리)')
  async getSummaryMngt(@Query() query: CommissionQueryDto) {
    // 관리자는 yearMonth와 userId 모두 자유롭게 필터링 가능 (둘 다 없으면 전체 이력 조회됨)
    return this.commissionService.getCommissionSummary(
      query.yearMonth,
      query.userId,
      query.commissionType,
      query.year,
    );
  }

  /**
   * 관리자 수당 금액 조정
   */
  @Post('manage/adjust')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @AuditEntity('tb_commission_ledger')
  @AuditKey('id')
  @Activity('수당 금액 조정')
  async adjustCommissionAmount(
    @Body() dto: AdjustCommissionDto,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.adjustCommissionAmount(dto, user, req);
  }

  /** 수당 조정 내역 삭제 */
  @Delete('manage/adjust/:historyId')
  @Permission('COMMISSION_MGMT', 'DELETE')
  @AuditEntity('tb_commission_ledger_history')
  @AuditKey('historyId')
  @Activity('수당 조정 내역 삭제')
  async deleteCommissionAdjustment(
    @Param('historyId', ParseIntPipe) historyId: number,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.deleteCommissionAdjustment(
      historyId,
      user,
      req,
    );
  }

  /** (사용자용) 실적 조회 */
  @Get('my/performance')
  @Permission('MY_PERFORMANCE', 'VIEW')
  @Activity('실적 데이터 조회')
  async getMyPerformance(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    // 일반 사용자가 자기 ID가 아닌 것을 조회하려 할 때, 서비스에서 권한을 막음
    return this.commissionService.getPerformanceDataForUser(query, user.sub);
  }

  /** (사용자용) 하위 사용자 실적 조회 */
  @Get('my/downline-performance')
  @Permission('MY_PERFORMANCE', 'VIEW') // 권한은 내 실적 조회와 동일하게 가거나 별도 분리
  @Activity('하위 실적 조회')
  async getMyDownlinePerformance(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.getDownlinePerformanceDataForUser(
      query,
      user.sub,
    );
  }

  /** (사용자용) 증원수수료 상세내역 조회 */
  @Get('my/history')
  @Permission('MY_COMMISSION', 'VIEW')
  @Activity('증원수수료 조회')
  async getMyLedgerHistory(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.getCommissionLedgerHistoryForUser(
      query,
      user.sub,
      query.commissionType,
    );
  }

  /** (사용자용) 승진 축하금 상세내역 조회 */
  @Get('my/promotion-bonus')
  @Permission('MY_PROMOTION_BONUS', 'VIEW')
  @Activity('승진 축하금 조회')
  async getMyPromotionBonusHistory(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.getCommissionLedgerHistoryForUser(
      query,
      user.sub,
      query.commissionType,
    );
  }

  @Get('my/summary')
  @Permission('MY_COMMISSION', 'VIEW')
  @Activity('내 수당 요약 조회')
  async getMySummary(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: any,
  ) {
    // 사용자는 본인 ID로 강제 필터링
    return this.commissionService.getCommissionSummary(
      query.yearMonth,
      user.sub,
      query.commissionType,
      query.year,
    );
  }

  @Get('status')
  @Permission('COMMISSION_MGMT', 'VIEW')
  @Activity('월별 수당 상태 조회')
  async getMonthStatus(@Query('yearMonth') yearMonth: string) {
    return this.commissionService.getMonthStatus(yearMonth);
  }

  @Get('dashboard')
  @Activity('대시보드 요약 조회')
  async getDashboardSummary(
    @Query('yearMonth') yearMonth: string,
    @Query('commissionType') commissionType: string,
    @CurrentUser() user: any,
  ) {
    if (!yearMonth) {
      // 기본값 처리는 서비스나 프론트에서 할 수도 있지만, 명시적 에러가 나을 수도 있음
      // 여기서는 편의상 에러 대신 빈 값 또는 현재 월 처리 등을 고려 가능
      throw new BadRequestException('yearMonth is required');
    }
    return this.commissionService.getDashboardSummary(
      yearMonth,
      user,
      commissionType,
    );
  }
}
