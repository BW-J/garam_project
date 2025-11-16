export type RawPermission = 'view' | 'create' | 'update' | 'delete';

export interface PermissionSet {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function toPermissionSet(perms: RawPermission[] = []): PermissionSet {
  return {
    canView: perms.includes('view'),
    canCreate: perms.includes('create'),
    canEdit: perms.includes('update'),
    canDelete: perms.includes('delete'),
  };
}

export function findMenuPermission(
  menus: any[] | undefined | null,
  match: { path?: string; name?: string },
): RawPermission[] {
  if (!menus?.length) return [];
  for (const m of menus) {
    const ok = (match.path && m.path === match.path) || (match.name && m.name === match.name);
    if (ok) return (m.permissions as RawPermission[]) ?? [];
    if (m.children?.length) {
      const found = findMenuPermission(m.children, match);
      if (found.length) return found;
    }
  }
  return [];
}

/**
 * 현재 브라우저 경로(window.location.pathname) 기준으로
 * 메뉴 권한을 자동 감지하여 PermissionSet 반환
 */
export function getCurrentMenuPermission(authorizedMenu: any[] | undefined | null): PermissionSet {
  //const authorizedMenu = useAuthStore.getState().authorizedMenu;
  const rawHash = window.location.hash;
  const currentPath = rawHash.startsWith('#')
    ? rawHash.replace(/^#/, '')
    : window.location.pathname;
  const raw = findMenuPermission(authorizedMenu, { path: currentPath });
  return toPermissionSet(raw);
}

export function findMenuByPath(
  menus: any[] | undefined | null,
  currentPath: string,
): any | undefined {
  if (!menus || !menus.length) return undefined;

  for (const menu of menus) {
    // 1. 정확히 일치하는 경우
    if (menu.path === currentPath) {
      return menu;
    }
    // 2. 동적 라우트('/board/:type') 매칭을 위한 보완 로직
    // 실제 메뉴 path가 '/board/NOTICE'이고, 현재 URL도 '/board/NOTICE'이면 정확히 일치함.
    // 혹시 URL에 쿼리스트링 등이 붙을 경우를 대비해 startsWith 등을 고려할 수도 있지만,
    // 현재 구조에서는 exact match로도 충분할 것으로 보임.

    // 자식 노드 탐색
    if (menu.children?.length) {
      const found = findMenuByPath(menu.children, currentPath);
      if (found) return found;
    }
  }
  return undefined;
}

export function getCurrentMenu(authorizedMenu: any[] | undefined | null): any | undefined {
  const rawHash = window.location.hash;
  // 해시 라우터(#) 사용 시 path 추출
  const currentPath = rawHash.startsWith('#')
    ? rawHash.replace(/^#/, '').split('?')[0]
    : window.location.pathname.split('?')[0];

  return findMenuByPath(authorizedMenu, currentPath);
}
