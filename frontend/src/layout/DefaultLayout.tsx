import { useState, useEffect } from 'react';
import { AppContent, AppSidebar, AppHeader, AppBreadcrumb } from '../components/index';
import classNames from 'classnames';

// (창 크기 감지 훅)
const useWindowSize = () => {
  const [size, setSize] = useState([window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const handleResize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
};

const DefaultLayout = () => {
  const [width] = useWindowSize();
  const isMobile = width <= 991;

  const [sidebarShow, setSidebarShow] = useState(!isMobile); // 사이드바 표시 상태
  const toggleSidebar = () => setSidebarShow((prev) => !prev);
  const closeSidebar = () => setSidebarShow(false); // 모바일에서 닫기용

  // .sidebar-hidden 클래스를 데스크탑에서만 토글
  const layoutClass = classNames({
    'sidebar-hidden': !sidebarShow && !isMobile,
  });

  return (
    <div className={layoutClass}>
      {/* 1. 헤더 (로고 없음) */}
      <AppHeader onToggleSidebar={toggleSidebar} />

      {/* 2. 사이드바 (로고 있음) */}
      <AppSidebar
        visible={sidebarShow} // 모바일에선 prop, 데스크탑에선 CSS
        onClose={closeSidebar}
        isMobile={isMobile}
      />

      {/* 3. 새로운 콘텐츠 래퍼 */}
      <div className="app-content-wrapper">
        <AppBreadcrumb />
        <main className="app-main-content">
          {/* Breadcrumb가 이제 올바른 패딩 영역 안에 위치합니다. */}
          <AppContent />
        </main>
      </div>
    </div>
  );
};

export default DefaultLayout;
