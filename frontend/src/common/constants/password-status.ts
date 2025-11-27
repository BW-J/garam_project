export const PasswordStatus = {
  OK: 'OK',
  MUST_CHANGE: 'MUST_CHANGE',
  EXPIRED: 'EXPIRED',
} as const;

export type PasswordStatus = (typeof PasswordStatus)[keyof typeof PasswordStatus];
