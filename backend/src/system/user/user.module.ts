import { forwardRef, Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/core/entities/tb_user.entity';
import { DepartmentModule } from '../department/department.module';
import { PositionModule } from '../position/position.module';
import { UserPasswordHistory } from 'src/core/entities/tb_user_password_history';
import { ConfigModule } from '@nestjs/config';
import { UserPasswordService } from './user-password.service';
import { UserClosureModule } from '../user-closure/user-closure.module';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { UserPositionHistory } from 'src/core/entities/tb_user_position_history.entity';
import { PerformanceData } from 'src/core/entities/tb_performance_data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPasswordHistory,
      UserClosure,
      UserPositionHistory,
      PerformanceData,
    ]),
    forwardRef(() => DepartmentModule),
    forwardRef(() => PositionModule),
    ConfigModule,
    UserClosureModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserPasswordService],
  exports: [UserService],
})
export class UserModule {}
