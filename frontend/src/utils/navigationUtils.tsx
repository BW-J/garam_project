import type { NavigateFunction } from 'react-router-dom';
import type { MenuItem } from 'primereact/menuitem';

// 백엔드 authorizedMenu 항목 타입 (authStore.ts 참고)
interface AuthorizedMenuItem {
  id: number;
  name: string;
  path?: string | null;
  parentId?: number | null;
  permissions?: string[];
  children?: AuthorizedMenuItem[];
  icon?: string | null;
}

/**
 * PrimeReact의 MenuItem 타입으로 변환합니다.
 *
 * @param item 백엔드에서 받은 메뉴 아이템
 * @param navigate React Router의 navigate 함수
 * @returns PrimeReact의 MenuItem
 */
const transformToPrimeMenuItem = (
  item: AuthorizedMenuItem,
  navigate: NavigateFunction,
  onClose?: () => void,
  currentPath?: string,
): MenuItem => {
  const hasChildren = !!(item.children && item.children.length > 0);

  const iconClass = item.icon && typeof item.icon === 'string' ? item.icon : 'pi pi-fw pi-file';

  const isActive = !!(item.path && currentPath && currentPath.startsWith(item.path));

  const primeItem: MenuItem = {
    label: item.name,
    icon: iconClass,
    className: isActive ? 'menu-active' : undefined,
  };

  if (hasChildren) {
    // 자식이 있으면 재귀 호출
    primeItem.items = item.children!.map((child) =>
      transformToPrimeMenuItem(child, navigate, onClose),
    );
  } else if (item.path) {
    // 자식이 없고 경로가 있으면 'command'로 내비게이션 함수 연결
    primeItem.command = () => {
      if (item.path) {
        navigate(item.path);
        onClose?.();
      }
    };
  }

  return primeItem;
};

/**
 * 백엔드 메뉴 데이터를 PrimeReact <PanelMenu>가 요구하는 형식으로 변환합니다.
 *
 * @param menuData useAuthStore의 authorizedMenu
 * @param navigate React Router의 navigate 함수
 * @returns <PanelMenu>의 model prop
 */
export const transformMenuData = (
  menuData: AuthorizedMenuItem[] | null | undefined,
  navigate: NavigateFunction,
  onClose?: () => void,
  currentPath?: string,
): MenuItem[] => {
  if (!menuData) return [];
  return menuData.map((item) => transformToPrimeMenuItem(item, navigate, onClose, currentPath));
};
