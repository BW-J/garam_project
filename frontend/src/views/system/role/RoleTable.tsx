import { useMemo, useRef, useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import type { Role } from 'src/config/types/Role';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getRoleColumns } from 'src/config/grid-defs/roleColDefs';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import type { DataTableFilterMeta } from 'primereact/datatable';

interface RoleTableProps {
  selectedRole: Role | null;
  setSelectedRole: (role: Role | null) => void;
}

export default function RoleTable({ selectedRole, setSelectedRole }: RoleTableProps) {
  const toast = useRef<Toast | null>(null);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    isActive: { value: true, matchMode: 'equals' },

    roleNm: { value: null, matchMode: 'contains' },
    roleCd: { value: null, matchMode: 'contains' },
  });

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
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
  } = useDataTable<Role>({
    apiBaseUrl: '/system/role',
    idField: 'roleId',
    toast: toast,
    newRowDefaults: {
      roleNm: '',
      roleCd: '',
      description: '',
      isActive: true,
    },
  });

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">역할 목록</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadRows}
        className="p-button-sm"
        outlined
      />
    </div>
  );

  const roleCols = useMemo(
    () =>
      getRoleColumns({
        deleteRow,
        permissions: permissionSet,
        onAddRoot: permissionSet.canCreate ? addRowAndEdit : undefined,
      }),
    [deleteRow, permissionSet, addRowAndEdit],
  );

  return (
    <>
      <Toast ref={toast} />
      {/* 'card-flex-full' 클래스로 높이/너비 제어 */}
      <Card header={cardHeader} className="card-flex-full">
        {loading ? (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        ) : (
          <ReusableDataTable
            value={rows}
            editMode="row"
            dataKey="roleId"
            editingRows={editingRows}
            onRowEditComplete={onRowEditComplete}
            onRowEditChange={onRowEditChange}
            useHeader
            useGlobalFilter
            globalFilterValue={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            onReload={loadRows}
            loading={loading}
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            selectionMode="single"
            selection={selectedRole}
            filterDisplay="row"
            onSelectionChange={(e) => setSelectedRole(e.value)}
            metaKeySelection={false}
            filters={filters}
            onFilter={(e) => setFilters(e.filters)}
            onRowClick={(e) => {
              // 현재 선택된 역할이 있고, 클릭한 행의 ID와 같다면 선택 해제
              if (selectedRole && selectedRole.roleId === e.data.roleId) {
                setSelectedRole(null);
              }
            }}
          >
            {roleCols}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
