import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/system/user/user.module';
import { SessionModule } from 'src/system/session/session.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoleModule } from 'src/system/role/role.module';
import { LogModule } from 'src/system/logs/log.module';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule], // ConfigService를 사용하기 위해 ConfigModule 임포트
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          // 서버 시작 시 .env 로드 실패하면 여기서 에러 발생
          throw new Error(
            'JWT_SECRET is not defined in environment variables for JwtModule.',
          );
        }
        return {
          secret: secret,
          // signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') }, // 만료 시간 등 다른 옵션도 여기서 설정 가능
        };
      },
      inject: [ConfigService], // useFactory에 ConfigService 주입
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
    SessionModule,
    ConfigModule,
    RoleModule,
    LogModule,
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, PassportModule, JwtAuthGuard, JwtStrategy],
})
export class AuthModule {}
