// src/types/GridTypes.ts
export type CrudMeta = {
  isNew?: boolean;
  isEditing?: boolean;
  /** Tree Data용 경로(옵션). 안 쓰면 생략 */
  path?: string[];
  /** Children을 쓰는 경우를 허용(트리) */
  children?: any[];
  action?: any;
};

// 도메인 타입 위에 그리드 메타를 얹어서 사용
export type WithCrud<T> = T & CrudMeta;
