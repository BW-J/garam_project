import type { Request } from 'express';
import { PasswordStatus } from 'src/common/constants/password-status';

export interface AuthorizedRequest extends Request {
  cookies: Record<string, string>;
  user?: {
    sub: number;
    loginId: string;
    userNm: string;
    roles?: any; // JwtRole 타입이나 any
    roleIds?: number[];
    isSuperAdmin?: boolean;
    sessionId?: string;
    email?: string;
    cellPhone?: string;
    passwordStatus?: PasswordStatus;
  };
}
