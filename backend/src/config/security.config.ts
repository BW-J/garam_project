import { registerAs } from '@nestjs/config';

// 'security'라는 네임스페이스로 설정을 등록합니다.
export default registerAs('security', () => ({
  /**
   * 로그인 실패 횟수 제한 정책
   */
  isFailCountPolicyEnabled:
    process.env.PASSWORD_FAIL_COUNT_POLICY_ENABLED === 'true',
  maxFailCount: parseInt(process.env.PASSWORD_MAX_FAIL_COUNT || '5', 10),

  /**
   * 비밀번호 복잡도 (정규식) 정책
   */
  isComplexityPolicyEnabled:
    process.env.PASSWORD_COMPLEXITY_POLICY_ENABLED === 'true',

  // .env에서 정규식 '문자열'을 읽어옴 (기본값: 8자 이상, 영문/숫자/특수문자)
  passwordRegexString:
    process.env.PASSWORD_COMPLEXITY_REGEX ||
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$',

  // .env에서 메시지 '문자열'을 읽어옴
  passwordRegexMessage:
    process.env.PASSWORD_COMPLEXITY_MESSAGE ||
    '비밀번호는 최소 8자 이상, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.',

  /**
   * 비밀번호 변경 주기 정책 (미래 확장용)
   */
  isChangeCyclePolicyEnabled:
    process.env.PASSWORD_CHANGE_CYCLE_POLICY_ENABLED === 'true',
  changeCycleDays: parseInt(process.env.PASSWORD_CHANGE_CYCLE_DAYS || '90', 10),

  /**
   * 비밀번호 재사용 금지 정책
   */
  isReusePolicyEnabled: process.env.PASSWORD_REUSE_POLICY_ENABLED === 'true',
  reusePreventionCount: parseInt(
    process.env.PASSWORD_REUSE_PREVENTION_COUNT || '3',
    10,
  ),
}));
