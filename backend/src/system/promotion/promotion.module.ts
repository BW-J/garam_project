import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/core/entities/tb_user.entity';
import { Performance } from 'src/core/entities/tb_performance.entity';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import { Position } from 'src/core/entities/tb_position.entity';
import { UserModule } from '../user/user.module';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Performance,
      UserClosure,
      UserPositionHistory,
      Position,
    ]),
    forwardRef(() => UserModule), // UserService 주입을 위해
  ],
  providers: [PromotionService],
  controllers: [PromotionController],
  exports: [PromotionService],
})
export class PromotionModule {}
