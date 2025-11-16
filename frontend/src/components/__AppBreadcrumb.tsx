import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import routes from '../routes';

// ✅ PrimeReact 컴포넌트 임포트
import { BreadCrumb } from 'primereact/breadcrumb';
import type { MenuItem } from 'primereact/menuitem';

const AppBreadcrumb = () => {
  const currentLocation = useLocation().pathname;
  const navigate = useNavigate();

  // ⛔️ CoreUI 로직 (getRouteName, getBreadcrumbs)은 그대로 사용합니다.
  const getRouteName = (pathname: string, routes: any[]) => {
    const currentRoute = routes.find((route) => route.path === pathname);
    return currentRoute ? currentRoute.name : false;
  };

  const getBreadcrumbs = (location: string) => {
    const breadcrumbs: { pathname: string; name: string; active: boolean }[] = [];
    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`;
      const routeName = getRouteName(currentPathname, routes);
      routeName &&
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length,
        });
      return currentPathname;
    });
    return breadcrumbs;
  };

  // ✅ CoreUI breadcrumbs 배열을 PrimeReact 'model' 형식으로 변환합니다.
  const primeBreadcrumbs = useMemo((): MenuItem[] => {
    const coreBreadcrumbs = getBreadcrumbs(currentLocation);

    const items = coreBreadcrumbs.map(
      (breadcrumb): MenuItem => ({
        label: breadcrumb.name,
        // 마지막 (active) 항목은 command를 비활성화합니다.
        command: !breadcrumb.active ? () => navigate(breadcrumb.pathname) : undefined,
        // PrimeReact BreadCrumb은 마지막 항목을 자동으로 'disabled' 스타일로 만듭니다.
        // className: breadcrumb.active ? 'p-disabled' : '', // (선택 사항)
      }),
    );

    // PrimeReact 모델에 'Home' 추가
    return [{ label: 'Home', command: () => navigate('/') }, ...items];
  }, [currentLocation, navigate]);

  // ⛔️ <CBreadcrumb> 대신 <BreadCrumb> 사용
  return <BreadCrumb model={primeBreadcrumbs} className="app-breadcrumb" />;
};

export default React.memo(AppBreadcrumb);
