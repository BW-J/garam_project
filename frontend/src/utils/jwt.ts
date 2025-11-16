/**
 * Access Token이 만료되었는지 확인하는 유틸 함수
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000; // 초 → 밀리초로 변환

    return Date.now() > exp;
  } catch (error) {
    // 파싱 실패 시 만료로 간주
    return true;
  }
};
