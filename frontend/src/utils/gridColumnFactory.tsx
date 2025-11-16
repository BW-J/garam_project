import { Column } from 'primereact/column';
import type { ColumnProps } from 'primereact/column';

/**
 * 공통 컬럼 생성 유틸
 * 기본 필터, 정렬, 스타일 등 옵션을 표준화
 */
export function createColumnDef<T>(field: keyof T, header: string, options?: Partial<ColumnProps>) {
  return (
    <Column
      key={String(field)}
      field={String(field)}
      header={header}
      filter
      sortable
      showFilterMenu={false}
      style={{ minWidth: '10rem', ...(options?.style || {}) }}
      {...options}
    />
  );
}
