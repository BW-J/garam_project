import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionLedger } from 'src/core/entities/tb_commission_ledger.entity';
import { Performance } from 'src/core/entities/tb_performance.entity';
import { UserModule } from '../user/user.module';

import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';
import { MulterModule } from '@nestjs/platform-express';
import { User } from 'src/core/entities/tb_user.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { PromotionModule } from '../promotion/promotion.module';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import { CommissionLedgerHistory } from 'src/core/entities/tb_commission_ledger_history.entity';
import { PerformanceDetail } from 'src/core/entities/tb_performance_detail.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Performance,
      PerformanceDetail,
      CommissionLedger,
      CommissionLedgerHistory,
      User,
      UserClosure,
      UserPositionHistory,
    ]),
    UserModule, // UserService, UserClosureService 등을 사용하기 위해
    PromotionModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  providers: [CommissionService],
  controllers: [CommissionController],
})
export class CommissionModule {}
