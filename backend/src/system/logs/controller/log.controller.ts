import { Controller, Get, Query } from '@nestjs/common';
import { LogQueryService } from '../services/log-query.service';
import { SearchLogDto } from '../dto/search-log.dto';
import { Permission } from 'src/common/decorators/permession.decorator';

@Controller('system/logs')
export class LogController {
  constructor(private readonly logService: LogQueryService) {}

  /**
   * 감사 로그만 조회
   * GET /system/logs/audit
   */
  @Permission('LOG', 'VIEW')
  @Get('audit')
  async getAuditLogs(@Query() filters: SearchLogDto) {
    return this.logService.findAuditLogs(filters);
  }

  /**
   * 사용자 행위 로그만 조회
   * GET /system/logs/activity
   */
  @Permission('LOG', 'VIEW')
  @Get('activity')
  async getActivityLogs(@Query() filters: SearchLogDto) {
    return this.logService.findActivityLogs(filters);
  }

  /**
   * 통합 로그 조회 (감사 + 행위)
   * GET /system/logs/unified
   */
  @Permission('LOG', 'VIEW')
  @Get('unified')
  async getUnifiedLogs(@Query() filters: SearchLogDto) {
    return this.logService.findUnifiedLogs(filters);
  }
}
