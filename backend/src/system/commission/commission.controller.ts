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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommissionService } from './commission.service';
import { UploadPerformanceDto } from './dto/upload-performance.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { UpdatePerformanceDto } from './dto/update-performance.dto';
import { CalculateCommissionDto } from './dto/calculate-commission.dto';
import { CommissionQueryDto } from './dto/query-commission.dto';
import type { AuthorizedRequest } from 'src/types/http';
import { AdjustCommissionDto } from './dto/adjust-commission.dto';

@Controller('system/commission')
@AuditEntity('PERFORMANCE_DATA') // 감사 로그용
@AuditKey('userNm')
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

  /** 2. (관리자) 실적 수정 */
  @Patch('performance/:id')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @Activity('실적 데이터 수정')
  async updatePerformance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformanceDto,
    @CurrentUser() user: any,
    @Req() req: AuthorizedRequest,
  ) {
    return this.commissionService.updatePerformanceData(id, dto, user, req);
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
    );
  }

  /**
   * 관리자 수당 금액 조정
   */
  @Post('manage/adjust')
  @Permission('COMMISSION_MGMT', 'UPDATE')
  @Activity('수당 금액 조정')
  async adjustCommissionAmount(
    @Body() dto: AdjustCommissionDto,
    @CurrentUser() user: any,
  ) {
    return this.commissionService.adjustCommissionAmount(dto, user);
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
  @Permission('MY_BONUS', 'VIEW')
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
    @CurrentUser() user: any,
  ) {
    if (!yearMonth) {
      // 기본값 처리는 서비스나 프론트에서 할 수도 있지만, 명시적 에러가 나을 수도 있음
      // 여기서는 편의상 에러 대신 빈 값 또는 현재 월 처리 등을 고려 가능
      throw new BadRequestException('yearMonth is required');
    }
    return this.commissionService.getDashboardSummary(yearMonth, user);
  }
}
