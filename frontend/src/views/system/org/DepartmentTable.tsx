import { useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Card } from 'primereact/card';

import { useTreeTable } from 'src/hooks/useTreeTable';
import { ReusableTreeTable } from 'src/components/grid/ReusableTreeTable';
import { getDepartmentColumns } from 'src/config/grid-defs/departmentColDefs';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';

import type { Department } from 'src/config/types/Department';
import type { WithCrud } from 'src/config/types/GridTypes';
import type { PrimeTreeNode, ApiNode } from 'src/utils/treeUtils';
import { useAuthStore } from 'src/store/authStore';

type DeptApiNode = ApiNode<Department> & WithCrud<Department>;
type DeptTreeNode = PrimeTreeNode<Department>;

export default function DepartmentTable() {
  const toastRef = useRef<Toast | null>(null);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

  // ─ 트리 테이블 훅 (변경 없음)
  const {
    nodes,
    loading,
    globalFilter,
    editingKey,
    editingRowData,
    expandedKeys,
    filters,
    setGlobalFilter,
    setExpandedKeys,
    onFilter,
    loadNodes,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNode,
    setEditingData,
    addRootNode,
    addChildNode,
    totalNodeCount,
  } = useTreeTable<Department>({
    apiBaseUrl: '/system/department',
    idField: 'deptId',
    parentIdField: 'parentDeptId',
    parentObjectField: 'parent',
    toastRef,
    newRowDefaults: {
      deptNm: '',
      deptCd: '',
      sortOrder: 1,
      isActive: true,
    },
  });

  // ─ 최초 로드 (변경 없음)
  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // ─ 하위 부서 추가 (변경 없음)
  const handleAddChild = useCallback(
    (node: DeptTreeNode) => {
      addChildNode(node);
    },
    [addChildNode],
  );

  // ─ 페이지네이션 아이콘 (변경 없음)
  const paginatorLeft = <Button type="button" icon="pi pi-refresh" text onClick={loadNodes} />;
  const paginatorRight = <span />;

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">부서 관리</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadNodes}
        className="p-button-sm"
        outlined
      />
    </div>
  );

  // ─ 컬럼 정의
  const columns = useMemo(
    () =>
      getDepartmentColumns({
        editingKey,
        editingRowData: editingRowData as DeptApiNode,
        onEditDataChange: setEditingData,
        startEdit,
        cancelEdit,
        saveEdit,
        deleteNode,
        onAddChild: handleAddChild,
        permissions: permissionSet,
        deptTreeNodes: nodes,

        // 👇 [수정] 훅의 상태와 핸들러를 컬럼 정의 함수로 전달
        filters: filters,
        onFilter: onFilter,
        onAddRoot: permissionSet.canCreate ? addRootNode : undefined,
      }),
    [
      editingKey,
      editingRowData,
      setEditingData,
      startEdit,
      cancelEdit,
      saveEdit,
      deleteNode,
      handleAddChild,
      permissionSet,
      nodes,

      // 👇 [수정] 의존성 배열에 'filters'와 'onFilter'를 추가
      filters,
      onFilter,
      addRootNode,
    ],
  );

  return (
    <>
      <Toast ref={toastRef} />
      <Card header={cardHeader} className="h-full card-flex-full">
        {loading ? (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        ) : (
          <ReusableTreeTable
            value={nodes}
            editingKey={editingKey}
            useHeader
            useGlobalFilter
            globalFilterValue={globalFilter}
            //useAddRootButton={permissionSet.canCreate}
            onReload={loadNodes}
            onAddRoot={permissionSet.canCreate ? addRootNode : undefined}
            onGlobalFilterChange={setGlobalFilter}
            filterMode="strict"
            expandedKeys={expandedKeys}
            onToggle={(e) => setExpandedKeys(e.value)}
            loading={loading}
            usePagination
            useGridlines={false}
            defaultRows={10}
            paginatorLeft={paginatorLeft}
            paginatorRight={paginatorRight}
            totalNodeCount={totalNodeCount}
            filters={filters}
            onFilter={onFilter}
            scrollHeight="flex"
          >
            {columns}
          </ReusableTreeTable>
        )}
      </Card>
    </>
  );
}
