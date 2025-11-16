export interface Department {
  deptId: number;
  deptCd: string | null;
  deptNm: string;
  parentDeptId?: number | null; // 트리 구조를 위해 필요할 수 있음
  sortOrder?: number;
  isActive: boolean;
  parent?: Department;
  // children?: Department[]; // 백엔드 findTrees 응답 형식에 따라 추가
}
