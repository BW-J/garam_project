import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 비밀번호 만료 시 던질 커스텀 예외
 * 프론트엔드는 이 예외를 받고 (예: 403 Forbidden + 'PASSWORD_EXPIRED' 메시지)
 * 비밀번호 변경 모달을 강제로 띄웁니다.
 */
export class PasswordExpiredException extends HttpException {
  constructor() {
    super('PASSWORD_EXPIRED', HttpStatus.FORBIDDEN);
  }
}
