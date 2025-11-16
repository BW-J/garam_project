export interface Menu {
  menuId: number;
  menuCd: string;
  menuNm: string;
  menuPath: string | null;
  parentMenuId: number | null;
  sortOrder: number;
  isActive: boolean;
  icon: string | null;

  // TreeTable에서 상위 객체 접근을 위함
  parent?: Menu;
  // TreeTable에서 하위 객체 접근을 위함
  children?: Menu[];
}
