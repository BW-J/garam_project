// api 호출을 위한 axios 설정
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { PasswordStatus } from 'src/common/constants/password-status';
import { useAuthStore } from 'src/store/authStore';

const api = axios.create({
  baseURL: '/api', // NestJS 백엔드 주소
  withCredentials: true, //  refresh 쿠키 전송 허용
});

// --- 요청 인터셉터 ---
api.interceptors.request.use(
  (config): InternalAxiosRequestConfig => {
    // ✅ 전역 상태에서 accessToken 가져오기 (임시 함수 사용)
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

//  응답 인터셉터: 401 → refresh 시도 → 재요청
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = []; // 초기화
};

api.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response.data;
    }
    // 기존 로직 (JSON 응답 처리)
    return response.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || !originalRequest) {
      console.error('Network Error or no response:', error);
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const url = originalRequest.url || '';

    //  로그인, refresh, 로그아웃 요청은 인터셉터 우회
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    //  Access Token 만료 → refresh 시도
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            // 새 토큰으로 헤더 교체 후 원래 요청 재시도
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const { data: refreshData } = await api.post('/auth/refresh');
        const newAccessToken = (refreshData as any).accessToken;

        if (!newAccessToken) throw new Error('No access token received');
        useAuthStore.getState().actions.setAccessToken(newAccessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        onRefreshed(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // ✅ 리프레시 실패 시 인증 정보 클리어 및 로그인 페이지로 강제 이동
        useAuthStore.getState().actions.logout();

        //  이미 로그인 페이지면 이동하지 않음
        if (!window.location.hash.endsWith('#/login')) {
          window.location.href = '#/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 3. 비밀번호 변경 주기 만료 (403 Forbidden + 'PASSWORD_EXPIRED')
    if (status === 403 && (data as any)?.message === 'PASSWORD_EXPIRED') {
      useAuthStore.getState().actions.setPasswordStatus(PasswordStatus.EXPIRED);

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
