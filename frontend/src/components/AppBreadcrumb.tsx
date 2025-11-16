import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BreadCrumb } from 'primereact/breadcrumb';
import type { MenuItem, MenuItemCommandEvent } from 'primereact/menuitem';
import { useAuthStore } from 'src/store/authStore';

// 메뉴 트리를 탐색하여 현재 경로에 해당하는 Breadcrumb 아이템들을 찾는 재귀 함수
const findBreadcrumbs = (
  menus: any[],
  currentPath: string,
  parents: MenuItem[] = [],
): MenuItem[] | null => {
  if (!menus) return null;

  for (const menu of menus) {
    // 현재 메뉴의 MenuItem 객체 생성
    // (부모 메뉴는 클릭해도 이동 안 하도록 command 제거, 실제 페이지는 이동 가능하도록 설정)
    const item: MenuItem = {
      label: menu.menuNm || menu.name, // 백엔드 응답 필드명에 따라 조정 (menuNm 또는 name)
      url: menu.menuPath || menu.path, // (선택 사항) PrimeReact BreadCrumb은 url 있으면 a 태그로 렌더링
    };

    // 1. 경로가 정확히 일치하는 경우 (현재 페이지 찾음)
    //    (동적 라우트의 경우 /board/NOTICE 처럼 실제 경로가 일치해야 함)
    if (menu.menuPath === currentPath || menu.path === currentPath) {
      return [...parents, item];
    }

    // 2. 자식 노드 탐색
    if (menu.children && menu.children.length > 0) {
      const found = findBreadcrumbs(menu.children, currentPath, [...parents, item]);
      if (found) return found;
    }
  }
  return null;
};

const AppBreadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);

  const items = useMemo(() => {
    const currentPath = location.pathname;
    // 메뉴 트리에서 현재 경로에 맞는 Breadcrumb 목록 찾기
    const crumbs = findBreadcrumbs(authorizedMenu || [], currentPath) || [];

    // 각 아이템에 네비게이션 기능 추가 (필요한 경우)
    return crumbs.map((crumb, index) => ({
      ...crumb,
      command: (event: MenuItemCommandEvent) => {
        // 마지막 항목(현재 페이지)이 아니고, 이동할 경로가 있다면 이동
        if (index < crumbs.length - 1 && crumb.url) {
          event.originalEvent.preventDefault(); // 기본 a 태그 동작 방지
          navigate(crumb.url);
        }
      },
      // PrimeReact BreadCrumb에서 url 속성이 있으면 자동으로 링크가 되므로,
      // react-router로 제어하려면 위 command를 쓰거나 url을 제거하고 command만 써야 함.
      // 여기서는 단순화를 위해 url은 제거하고 label만 남기는 방식도 고려 가능.
      url: undefined, // react-router navigate 사용을 위해 url 제거
    }));
  }, [authorizedMenu, location.pathname, navigate]);

  const home = { icon: 'pi pi-home', command: () => navigate('/dashboard') };

  return <BreadCrumb model={items} home={home} className="app-breadcrumb border-none mb-3" />;
};

export default React.memo(AppBreadcrumb);
