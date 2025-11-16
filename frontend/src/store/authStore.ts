import { PasswordStatus } from 'src/common/constants/password-status';
import { create } from 'zustand';

// 사용자 정보 타입 (로그인 응답 참고)
export interface UserState {
  userId: number;
  loginId: string;
  userNm: string;
  isSuperAdmin: boolean;
  email: string;
  cellPhone: string;
  passwordStatus?: PasswordStatus;
}

// 권한 메뉴 타입 (로그인 응답 참고)
// (백엔드의 buildAuthorizedMenuTree 반환 타입에 맞게 구체화 필요)
interface AuthorizedMenuItem {
  id: number;
  name: string;
  path?: string;
  parentId?: number | null;
  permissions?: string[];
  children?: AuthorizedMenuItem[];
  // CoreUI NavLink에서 요구하는 추가 속성 (icon 등)은 변환 시 추가
}

// 스토어 상태 타입 정의
interface AuthState {
  user: UserState | null;
  accessToken: string | null;
  authorizedMenu: AuthorizedMenuItem[] | null | undefined;
  isLoggedIn: boolean; // 로그인 여부를 명시적으로 관리
  isLoading: boolean;
  passwordStatus?: PasswordStatus;
  actions: {
    login: (user: UserState, token: string, menu: AuthorizedMenuItem[]) => void;
    logout: () => void;
    setAccessToken: (token: string | null) => void;
    // (선택) 초기화 액션 (앱 로드 시 사용 가능)
    // initialize: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    updateUserInfo: (newUserInfo: Partial<UserState>) => void;
    setPasswordStatus: (status: PasswordStatus) => void;
  };
}

// 스토어 생성
// persist 미들웨어: 선택 사항. accessToken을 localStorage에 저장하여 새로고침해도 로그인 유지.
//                 단, accessToken은 탈취 위험이 있으므로 메모리 저장(persist 제거)이 더 안전할 수 있음.
//                 이 경우 새로고침 시 토큰이 사라지므로, 앱 로드 시 /auth/refresh를 호출하여
//                 자동 로그인(Silent Refresh)을 구현해야 함. 여기서는 일단 persist 사용.
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  authorizedMenu: null,
  isLoggedIn: false,
  isLoading: true,
  passwordStatus: PasswordStatus.OK,
  actions: {
    login: (user, token, menu) =>
      set({
        user,
        accessToken: token,
        authorizedMenu: menu,
        isLoggedIn: true,
        isLoading: false,
        passwordStatus: user.passwordStatus || PasswordStatus.OK,
      }),
    logout: () =>
      set({
        user: null,
        accessToken: null,
        authorizedMenu: null,
        isLoggedIn: false,
        isLoading: false,
        passwordStatus: PasswordStatus.OK,
      }),
    setAccessToken: (token) =>
      set({
        accessToken: token,
        // 토큰이 새로 설정되면 로그인 상태로 간주 (refresh 성공 시)
        isLoggedIn: !!token,
        isLoading: false,
      }),

    setLoading: (loading) => set({ isLoading: loading }),
    updateUserInfo: (newUserInfo) =>
      set((state) => ({
        user: state.user ? { ...state.user, ...newUserInfo } : null,
      })),

    // (선택) 초기화: 앱 시작 시 localStorage 토큰 유효성 검사 후 상태 설정
    // initialize: (token) => {
    //   if (token && !isTokenExpired(token)) { // isTokenExpired 유틸 함수 필요
    //     set({ accessToken: token, isLoggedIn: true });
    //     // 필요시 여기서 /users/me 호출하여 user, authorizedMenu 정보 로드
    //   } else {
    //     set({ accessToken: null, isLoggedIn: false });
    //   }
    // },
    setPasswordStatus: (status) => set({ passwordStatus: status }),
  },
}));

// 액션만 쉽게 가져다 쓰기 위한 편의 export (선택 사항)
export const useAuthActions = () => useAuthStore((state) => state.actions);

// (선택) accessToken만 필요할 때 쉽게 가져오는 selector (최적화)
export const useAccessToken = () => useAuthStore((state) => state.accessToken);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
