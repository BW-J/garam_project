export enum PasswordStatus {
  OK = 'OK', // 정상
  MUST_CHANGE = 'MUST_CHANGE', // 강제 변경 필요 (초기 상태 등)
  EXPIRED = 'EXPIRED', // 만료됨 (연장 가능)
}
