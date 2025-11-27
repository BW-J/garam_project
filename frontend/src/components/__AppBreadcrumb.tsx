import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import routes from '../routes';

import { BreadCrumb } from 'primereact/breadcrumb';
import type { MenuItem } from 'primereact/menuitem';

const AppBreadcrumb = () => {
  const currentLocation = useLocation().pathname;
  const navigate = useNavigate();

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

  return <BreadCrumb model={primeBreadcrumbs} className="app-breadcrumb" />;
};

export default React.memo(AppBreadcrumb);
