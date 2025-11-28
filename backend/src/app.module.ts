import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { DepartmentModule } from './system/department/department.module';
import { RoleModule } from './system/role/role.module';
import { PositionModule } from './system/position/position.module';
import { InterceptorModule } from './common/interceptors/interceptor.module';
import { UserModule } from './system/user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RolePermissionsGuard } from './auth/guards/role-permissions.guard';
import { UserRoleMapModule } from './system/user-role/user-role-map.module';
import { PositionRoleMapModule } from './system/position-role/position-role-map.module';
import securityConfig from './config/security.config';
import { CommonUtilsModule } from './common/common-utils.module';
import { MenuModule } from './system/menu/menu.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UserClosureModule } from './system/user-closure/user-closure.module';
import { CommissionModule } from './system/commission/commission.module';
import { APP_GUARD } from '@nestjs/core';
import { PasswordPolicyGuard } from './auth/guards/password-policy.guard';
import { BoardModule } from './system/board/board.module';
import { PromotionModule } from './system/promotion/promotion.module';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmWinstonLogger } from './logger/typeorm-winston-logger';
import { createTypeOrmLogger } from './logger/winston-logger';
import { BankModule } from './system/bank/bank.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [securityConfig],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    CacheModule.register({
      isGlobal: true, // 전역으로 설정 (어디서든 주입 가능)
      ttl: 120 * 60 * 1000, // 2시간 (캐시 생명 주기)
      max: 10000, // 최대 항목 수
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // ConfigService에서 .env 값을 안전하게 읽어옵니다.
        const logPath = configService.get<string>('LOG_PATH') || './logs';

        // 이 시점에서 logPath는 'C:/dev/logs'가 됩니다.
        const typeOrmLoggerInstance = createTypeOrmLogger(logPath);
        return {
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'jung2806',
          database: 'pg_database',
          autoLoadEntities: true,
          synchronize: false,
          logging: true,
          logger: new TypeOrmWinstonLogger(typeOrmLoggerInstance),
        };
      },
    }),
    UserModule,
    AuthModule,
    CoreModule,
    MenuModule,
    RoleModule,
    DepartmentModule,
    PositionModule,
    InterceptorModule,
    UserRoleMapModule,
    PositionRoleMapModule,
    CommonUtilsModule,
    UserClosureModule,
    CommissionModule,
    BoardModule,
    PromotionModule,
    BankModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolePermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PasswordPolicyGuard,
    },
  ],
})
export class AppModule {}
