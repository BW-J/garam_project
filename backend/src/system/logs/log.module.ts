import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogQueryService } from './services/log-query.service';
import { LogController } from './controller/log.controller';
import { LoginLogService } from './services/login-log.service';
import { ActivityLogService } from './services/activity-log.service';
import { AuditLogService } from './services/audit-log.service';
import { AuditLog } from './entities/tb_audit_log.entity';
import { LoginLog } from './entities/tb_login_log.entity';
import { UserActivityLog } from './entities/tb_user_activity_log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, UserActivityLog, LoginLog])],
  providers: [
    LogQueryService,
    ActivityLogService,
    AuditLogService,
    LoginLogService,
  ],
  controllers: [LogController],
  exports: [ActivityLogService, AuditLogService, LoginLogService],
})
export class LogModule {}
