import { useMemo, useRef, useEffect } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import type { Action } from 'src/config/types/Action';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getActionColumns } from 'src/config/grid-defs/actionColDefs';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import { Button } from 'primereact/button';

export default function ActionTable() {
  const toast = useRef<Toast | null>(null);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    // ❗️ '메뉴/액션 관리' 메뉴의 권한을 사용해야 합니다 (추후 routes.tsx 경로 기준)
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
  } = useDataTable<Action>({
    apiBaseUrl: '/system/action', // 👈 [수정] 백엔드 ActionController
    idField: 'actionId', // 👈 [수정] Action PK
    toast: toast,
    newRowDefaults: {
      actionNm: '',
      actionCd: '',
      actionDesc: '',
      isActive: true,
    },
  });

  // 최초 로드
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">행동 관리</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadRows}
        className="p-button-sm"
        outlined
      />
    </div>
  );

  const actionCols = useMemo(
    () =>
      getActionColumns({
        deleteRow,
        permissions: permissionSet,
        onAddRoot: permissionSet.canCreate ? addRowAndEdit : undefined,
      }),
    [deleteRow, permissionSet, addRowAndEdit],
  );

  return (
    <>
      <Toast ref={toast} />
      <Card header={cardHeader} className="card-flex-full h-full">
        {loading ? (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        ) : (
          <ReusableDataTable
            value={rows}
            editMode="row"
            dataKey="actionId" // 👈 [수정] PK 지정
            editingRows={editingRows}
            onRowEditComplete={onRowEditComplete}
            onRowEditChange={onRowEditChange}
            useHeader
            useGlobalFilter
            globalFilterValue={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            useAddRootButton={permissionSet.canCreate}
            onReload={loadRows}
            onAddRoot={permissionSet.canCreate ? addRowAndEdit : undefined}
            loading={loading}
            usePagination
            filterDisplay="row"
            defaultRows={10}
            scrollHeight="flex"
          >
            {actionCols}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
