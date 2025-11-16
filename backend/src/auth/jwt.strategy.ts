import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, JwtFromRequestFunction } from 'passport-jwt';
import { PasswordStatus } from 'src/common/constants/password-status';
import { UserService } from 'src/system/user/user.service';

export interface JwtRole {
  id: number;
  code: string;
  name: string;
}

type JwtPayload = {
  sub: number;
  loginId: string;
  userNm?: string;
  roles?: JwtRole;
  roleIds?: number[];
  isSuperAdmin?: boolean;
  sessionId?: string;
  email: string;
  cellPhone: string;
};

export type ValidatedUser = JwtPayload & {
  passwordStatus: PasswordStatus;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly users: UserService,
    private readonly configService: ConfigService,
  ) {
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // .env 파일 로딩 실패 또는 키 누락 시 에러 발생 (서버 시작 시 확인 가능)
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    // request.user에 들어갈 값 반환
    const user = await this.users.findOneById(payload.sub);

    if (!user || !user.isActive) {
      this.logger.warn(`User not found for ID: ${payload.sub}`);
      throw new UnauthorizedException('비활성화된 사용자입니다.');
    }

    if (!payload.isSuperAdmin && user.department && !user.department.isActive) {
      throw new UnauthorizedException(
        '소속 부서가 비활성화되어 접근할 수 없습니다.',
      );
    }

    let passwordStatus = PasswordStatus.OK;
    const isPolicyEnabled = this.configService.get<boolean>(
      'security.isChangeCyclePolicyEnabled',
    );

    if (isPolicyEnabled && !payload.isSuperAdmin) {
      const cycleDays = this.configService.get<number>(
        'security.changeCycleDays',
      ) as number;
      const passwordChangedAt = user.passwordChangedAt; // User 엔티티에서 조회

      if (!passwordChangedAt) {
        passwordStatus = PasswordStatus.MUST_CHANGE;
      } else {
        const expirationDate = new Date(passwordChangedAt);
        expirationDate.setDate(expirationDate.getDate() + cycleDays);

        if (new Date() > expirationDate) {
          passwordStatus = PasswordStatus.EXPIRED;
        }
      }
    }
    return {
      sub: payload.sub,
      loginId: payload.loginId,
      userNm: payload.userNm,
      roles: payload.roles,
      roleIds: payload.roleIds,
      isSuperAdmin: payload.isSuperAdmin,
      sessionId: payload.sessionId,
      email: payload.email,
      cellPhone: payload.cellPhone,
      passwordStatus,
    };
  }
}
