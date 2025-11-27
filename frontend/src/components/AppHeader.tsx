import { useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toolbar } from 'primereact/toolbar';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { Avatar } from 'primereact/avatar';
import { PrimeReactContext } from 'primereact/api';
import type { MenuItem } from 'primereact/menuitem';
import api from '../api/axios';
import { useAuthStore, useAuthActions } from '../store/authStore';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

const AppHeader = ({ onToggleSidebar }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { changeTheme } = useContext(PrimeReactContext);
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuthActions();
  const userMenuRef = useRef<Menu>(null);

  // 로그아웃 처리 (기존 로직 재사용)
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('logout failed:', error);
    } finally {
      logout();
      // navigate('/login')은 PrivateRoute가 자동으로 처리해줍니다.
    }
  };

  // PrimeReact Menu 아이템 정의
  const userMenuItems: MenuItem[] = [
    {
      label: '설정',
      items: [
        {
          label: '프로필',
          icon: 'pi pi-fw pi-user',
          command: () => navigate('/profile'), // TODO: 프로필 경로 확인
        },
        // {
        //   label: '설정',
        //   icon: 'pi pi-fw pi-cog',
        //   command: () => navigate('/settings'), // TODO: 설정 경로 확인
        // },
      ],
    },
    /**  추 후 테마 변경 적용예정

    {
      label: '테마 변경',
      icon: 'pi pi-fw pi-palette',
      items: [
        {
          //  레이블 및 테마명 변경 (lara -> soho)
          label: '라이트 (Soho Light)',
          icon: 'pi pi-fw pi-sun',
          command: () => {
            //  lara-dark-blue -> soho-dark, lara-light-blue -> soho-light
            changeTheme?.('lara-dark-cyan', 'lara-light-cyan', 'theme-link');
          },
        },
        {
          //  레이블 및 테마명 변경 (lara -> soho)
          label: '다크 (Soho Dark)',
          icon: 'pi pi-fw pi-moon',
          command: () => {
            changeTheme?.('lara-light-cyan', 'lara-dark-cyan', 'theme-link');
          },
        },
      ],
    },
 */
    { separator: true },
    {
      label: '로그아웃',
      icon: 'pi pi-fw pi-power-off',
      command: handleLogout,
    },
  ];

  // 툴바 좌측 (사이드바 토글 버튼)
  const startContent = (
    <Button icon="pi pi-bars" onClick={onToggleSidebar} text rounded aria-label="Toggle Sidebar" />
  );

  // 툴바 우측 (사용자 메뉴)
  const endContent = (
    <>
      <Menu model={userMenuItems} ref={userMenuRef} popup />
      {/* flex align-items-center 클래스 추가로 수직 정렬 */}
      <Button
        className="p-button-text p-button-plain flex align-items-center"
        onClick={(e) => userMenuRef.current?.toggle(e)}
      >
        <Avatar label={user?.userNm ? user.userNm[0] : 'U'} shape="circle" className="mr-2" />
        <span>{user?.userNm || '사용자'}</span>
      </Button>
    </>
  );

  return (
    <div className="app-header">
      <Toolbar start={startContent} end={endContent} className="shadow-1" />
    </div>
  );
};

export default AppHeader;
