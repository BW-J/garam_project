import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import type { Position } from 'src/config/types/Position';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getPositionColumns } from 'src/config/grid-defs/positionColDefs';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import { Button } from 'primereact/button';
import type { DataTableFilterMeta } from 'primereact/datatable';

export default function PositionTable() {
  const toast = useRef<Toast | null>(null);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    isActive: { value: true, matchMode: 'equals' },
    positionNm: { value: null, matchMode: 'contains' },
    positionCd: { value: null, matchMode: 'contains' },
  });

  const onFilterChange = (e: { filters: DataTableFilterMeta }) => {
    // e.filters 안에 undefined나 null이 있는 필드 제거
    const cleanFilters: DataTableFilterMeta = {};

    Object.entries(e.filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        cleanFilters[key] = val;
      }
    });

    setFilters(cleanFilters);
  };

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    // '부서/직급관리' 메뉴의 권한을 사용합니다.
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

  const {
    rows,
    loading,
    editingRows,
    globalFilter,
    setGlobalFilter,
    loadRows,
    onRowEditComplete,
    onRowEditChange,
    addRowAndEdit,
    deleteRow,
  } = useDataTable<Position>({
    apiBaseUrl: '/system/position',
    idField: 'positionId',
    toast: toast,
    newRowDefaults: {
      positionNm: '',
      positionCd: '',
      sortOrder: 1,
      isActive: true,
    },
  });

  // 최초 로드
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">직급 관리</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadRows}
        className="p-button-sm"
        outlined
      />
    </div>
  );

  const posCols = useMemo(
    () =>
      getPositionColumns({
        deleteRow,
        permissions: permissionSet,
        onAddRoot: permissionSet.canCreate ? addRowAndEdit : undefined,
      }),
    [deleteRow, permissionSet, addRowAndEdit],
  );

  return (
    <>
      <Toast ref={toast} />
      <Card header={cardHeader} className="h-full card-flex-full">
        {loading ? (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        ) : (
          <ReusableDataTable
            value={rows}
            editMode="row"
            dataKey="positionId" // ❗️ PK 지정
            editingRows={editingRows}
            onRowEditComplete={onRowEditComplete}
            onRowEditChange={onRowEditChange}
            useHeader
            useGlobalFilter
            filterDisplay="row"
            globalFilterValue={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            useAddRootButton={permissionSet.canCreate}
            onReload={loadRows}
            onAddRoot={permissionSet.canCreate ? addRowAndEdit : undefined}
            loading={loading}
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            filters={filters}
            onFilter={onFilterChange}
          >
            {posCols}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
