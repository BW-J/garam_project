/**
 * 객체의 내용을 키 순서와 관계없이 안정적으로 직렬화(stable stringify)
 */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    // 배열은 순서가 의미 있을 수 있으므로 순서 그대로 직렬화
    const serializedArray = obj.map((v) => stableStringify(v)).join(',');
    return `[${serializedArray}]`;
  }

  // 객체의 키를 정렬해서 직렬화
  const keys = Object.keys(obj).sort();
  const keyValuePairs = keys.map(
    (key) => `"${key}":${stableStringify(obj[key])}`,
  );
  return `{${keyValuePairs.join(',')}}`;
}

/**
 * 객체 간의 변경된 필드만 추출 (단순 얕은 비교)
 */
export function diffObjects(oldObj: any, newObj: any) {
  const diff: Record<string, { old: any; new: any }> = {};
  if (!oldObj || !newObj) return diff;

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // undefined나 timestamp 등의 예외는 상황에 맞게 필터링 가능
    if (
      key === 'createdAt' ||
      key === 'updatedAt' ||
      key === 'createdBy' ||
      key === 'updatedBy' ||
      key === 'failCount' ||
      key === 'lastLoginAt' ||
      key === 'lastLoginAgent' ||
      key === 'recommenderPath' ||
      key === 'lastLoginIp' ||
      key === 'passwordChangedAt'
    ) {
      continue;
    }

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    let isEqual = oldVal == newVal;

    // 객체나 배열일 경우 문자열로 비교
    if (
      oldVal !== null &&
      newVal !== null &&
      typeof oldVal === 'object' &&
      typeof newVal === 'object'
    ) {
      isEqual = stableStringify(oldVal) === stableStringify(newVal);
    }

    if (!isEqual) {
      diff[key] = { old: oldVal, new: newVal };
    }
  }
  return diff;
}

/**
 * 민감한 필드를 재귀적으로 찾아 마스킹 처리하는 함수
 * @param data 마스킹할 객체 또는 배열
 * @returns 마스킹 처리된 객체 또는 배열
 */
export function maskSensitiveData(data: any): any {
  // 민감한 필드 키 목록 정의 (소문자 기준)
  const SENSITIVE_KEYS = [
    'password',
    'confirm_password',
    'token',
    'apikey',
    'secret',
    'auth_token',
    'authorization',
  ];

  // 객체나 배열이 아니면 그대로 반환
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // 배열인 경우 재귀적으로 처리
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  // 객체인 경우 처리
  const masked: Record<string, any> = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      // 키를 소문자로 변환하여 민감 키 목록과 비교
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_KEYS.includes(lowerKey)) {
        // 민감 필드 발견 시 마스킹
        masked[key] = '***MASKED_DATA***';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        // 중첩된 객체/배열인 경우 재귀 호출
        masked[key] = maskSensitiveData(data[key]);
      } else {
        // 일반 필드는 값 복사
        masked[key] = data[key];
      }
    }
  }
  return masked;
}
