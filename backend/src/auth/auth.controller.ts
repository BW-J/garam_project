import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Logger,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { IsString, IsNotEmpty } from 'class-validator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  loginId: string;
  // RSA로 암호화된 비밀번호(Base64)
  @IsString()
  @IsNotEmpty()
  password: string;
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // 💡 HTTPS 환경에서만 전송
  path: '/', // 💡 사이트 전체에서 유효하도록
  // maxAge: ... (auth.service의 refreshExp와 맞추는 것이 좋음)
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private readonly logger = new Logger(AuthController.name);

  /**
   * 공개키 제공: FE는 이 키로 password를 RSA 암호화해서 전달
   * @returns
   */
  @Public()
  @Get('public-key')
  async getPublicKey() {
    const publicKey = await this.auth.getPublicKey();
    return { publicKey };
  }

  /**
   * 로그인
   * @param dto
   * @param res
   * @param req
   * @returns
   */
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    //const xff = req.headers['x-forwarded-for'] as string;
    const ip = req.ip;
    const agent = req.headers['user-agent'];
    const { accessToken, refreshToken, user, authorizedMenu } =
      await this.auth.login(dto.loginId, dto.password, ip, agent);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken, user, authorizedMenu }; // 프론트는 로컬스토리지 등에 저장
  }

  /**
   * 로그아웃: 헤더/바디로 refreshToken 전달
   * @param bodyToken
   * @param req
   * @returns
   */
  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies['refresh_token'];
    await this.auth.logout(token);
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
    return { success: true };
  }

  /**
   * 토큰 재발급
   * @param bodyToken
   * @param req
   * @returns
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refresh_token'];

    if (!token) {
      throw new UnauthorizedException('Refresh token not found in cookie');
    }
    const { accessToken, refreshToken } = await this.auth.refreshByToken(token);

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    // 💡 새 accessToken만 Body로 반환
    return { accessToken };
  }

  /**
   * 현재 세션 정보 조회 (사용자 정보 + 권한 메뉴)
   * @param user
   * @returns
   */
  @Get('session-info')
  async getSessionInfo(@CurrentUser() user) {
    // 💡 JwtStrategy.validate에서 반환한 user 객체
    // JwtStrategy.validate에서 user 엔티티 전체를 반환하도록 수정했다면 user.userId 사용
    // 여기서는 payload 그대로 반환한다고 가정하고 user.sub 사용
    return this.auth.getSessionInfo(user.sub);
  }
}
