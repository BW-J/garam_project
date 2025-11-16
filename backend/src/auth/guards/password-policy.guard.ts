import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PasswordStatus } from 'src/common/constants/password-status';
import { PasswordExpiredException } from 'src/common/exceptions/password-expired.exception';
import type { AuthorizedRequest } from 'src/types/http';

@Injectable()
export class PasswordPolicyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const user = request.user;
    const { url, method } = request;

    // 로그인 전이거나 유저 정보가 없으면 통과 (JwtAuthGuard가 처리)
    if (!user) return true;

    // 비밀번호가 만료된 경우
    if (user.passwordStatus !== PasswordStatus.OK) {
      const isAllowed =
        (method === 'PATCH' && url.includes('/system/users/me/')) ||
        (method === 'POST' &&
          url.includes('/system/users/me/extend-password')) ||
        url.includes('/auth/logout');

      if (!isAllowed) {
        throw new PasswordExpiredException(); // 403 Forbidden + 'PASSWORD_EXPIRED'
      }
    }

    return true;
  }
}
