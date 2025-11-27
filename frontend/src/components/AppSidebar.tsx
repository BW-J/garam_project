import React, { useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from 'primereact/sidebar';
import { PanelMenu } from 'primereact/panelmenu';
import { useAuthStore } from '../store/authStore';
import { transformMenuData } from '../utils/navigationUtils';

interface AppSidebarProps {
  visible: boolean; // 사이드바 표시 여부
  onClose: () => void; // 닫기 함수
  isMobile: boolean; // 모바일 여부
}

const AppSidebar = ({ visible, onClose, isMobile }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);

  const navigationItems = useMemo(() => {
    const closeIfMobile = isMobile ? onClose : undefined;
    return transformMenuData(authorizedMenu, navigate, closeIfMobile, location.pathname);
  }, [authorizedMenu, isMobile, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // ❗ 데스크탑에서는 ESC 동작 막기
        if (!isMobile) {
          e.preventDefault();
          e.stopPropagation();
        }
        // 모바일/태블릿에서는 그대로 통과 → Sidebar가 정상적으로 닫힘
      }
    };

    // useCapture = true로 해야 Sidebar가 이벤트 받기 전에 차단됨
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isMobile]);

  // Sidebar 상단에 로고 표시
  const CustomHeader = (
    <div className="flex align-items-center">
      <NavLink to="/" className="p-sidebar-header-appname" style={{ textDecoration: 'none' }}>
        {/* 전체 로고 (Prime 아이콘 + 텍스트) */}
        <span className="sidebar-brand-full flex align-items-center gap-2">
          <i className="pi pi-prime" style={{ fontSize: '1.5rem' }}></i>
          <span className="font-semibold text-lg" style={{ color: 'var(--text-color)' }}>
            가람 사업단
          </span>
        </span>
        {/* 축소 로고 (Prime 아이콘) */}
        <span className="sidebar-brand-narrow">
          {/* <i className="pi pi-prime" style={{ fontSize: '1.5rem' }}></i> */}
        </span>
      </NavLink>
    </div>
  );

  return (
    <Sidebar
      visible={visible}
      onHide={onClose}
      modal={isMobile}
      dismissable={isMobile}
      className="app-sidebar"
      header={CustomHeader}
      showCloseIcon={isMobile}
    >
      {/* PanelMenu가 메뉴를 렌더링 */}
      <PanelMenu model={navigationItems} className="w-full" />
    </Sidebar>
  );
};

export default React.memo(AppSidebar);
