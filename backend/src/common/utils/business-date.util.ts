/**
 * 15일 기준으로 '유효 시작월(1일)'을 계산합니다.
 * (예: 3월 10일 입사 -> 3월 1일 반환)
 * (예: 3월 20일 입사 -> 4월 1일 반환)
 * @param joinDate 사용자의 입사일(createdAt)
 * @returns 해당 사용자의 1개월차가 시작되는 '월의 1일' Date 객체
 */
export function getEffectiveStartDate(joinDate: Date): Date {
  const d = new Date(joinDate.getTime());
  // 15일 룰 제거
  // if (d.getDate() <= 15) {
  //   // 15일 이전 입사: 당월 1일
  //   return new Date(d.getFullYear(), d.getMonth(), 1);
  // } else {
  //   // 15일 이후 입사: 익월 1일
  //   return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  // }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * '유효 시작월'을 기준으로 N개월차가 되는 'YYYY-MM' 문자열을 반환합니다.
 * (예: 3월 10일 입사(3/1 시작), N=1 -> 'YYYY-03')
 * (예: 3월 20일 입사(4/1 시작), N=1 -> 'YYYY-04')
 * @param joinDate 사용자의 입사일
 * @param N (N개월차)
 */
export function getNthMonthStr(joinDate: Date, N: number): string {
  const effectiveStartDate = getEffectiveStartDate(joinDate);

  // (N-1)개월을 더함 (1개월차 = 0개월 더함)
  const targetDate = new Date(
    effectiveStartDate.getFullYear(),
    effectiveStartDate.getMonth() + (N - 1),
    1,
  );

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

/**
 * 15일 이후 입사자인지 확인합니다. (실적 이월 대상자)
 * 15일 룰 제거로 인한 false 반환 처리. 확정 사항이 아니라 일단 유지
 */
export function isCarryOverTarget(joinDate: Date): boolean {
  return false;
}

/**
 * 입사 당월의 'YYYY-MM' 문자열을 반환합니다.
 * (실적 이월 계산 시 사용)
 */
export function getJoinMonthStr(joinDate: Date): string {
  const d = new Date(joinDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
