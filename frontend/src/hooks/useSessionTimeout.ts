import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useAuthActions } from 'src/store/authStore';
import { useNavigate } from 'react-router-dom';
import api from 'src/api/axios';

// 타임아웃 시간 설정 (30분 = 30 * 60 * 1000ms)
const TIMEOUT_MS = 30 * 60 * 1000;

export const useSessionTimeout = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const { logout } = useAuthActions();
  const navigate = useNavigate();

  // 타이머 참조를 저장하여 리렌더링 간 유지
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 로그아웃 처리 함수
  const handleLogout = useCallback(async () => {
    if (isLoggedIn) {
      console.warn('Session timed out due to inactivity.');
      try {
        // 1. 백엔드에 로그아웃 요청 (세션 무효화)
        await api.post('/auth/logout');
      } catch (e) {
        console.error('Backend logout failed during timeout', e);
      } finally {
        // 2. 프론트엔드 상태 클리어 및 이동
        logout();
        navigate('/login');
        alert('장시간 미사용으로 자동 로그아웃 되었습니다.');
      }
    }
  }, [isLoggedIn, logout, navigate]);

  // 활동 감지 시 타이머 리셋
  const resetTimer = useCallback(() => {
    if (!isLoggedIn) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // 새 타이머 시작
    timerRef.current = setTimeout(handleLogout, TIMEOUT_MS);
  }, [isLoggedIn, handleLogout]);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    if (!isLoggedIn) return;

    // 초기 타이머 시작
    resetTimer();

    // 감지할 사용자 이벤트 목록
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // 이벤트 핸들러 (Throttling을 적용하면 더 좋지만, 간단히 구현)
    const onActivity = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, onActivity);
    });

    // 클린업 (컴포넌트 언마운트 시 리스너 제거)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, onActivity);
      });
    };
  }, [isLoggedIn, resetTimer]);
};
