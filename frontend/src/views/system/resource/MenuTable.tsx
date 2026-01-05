import { useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Card } from 'primereact/card';
import { useTreeTable } from 'src/hooks/useTreeTable';
import { ReusableTreeTable } from 'src/components/grid/ReusableTreeTable';
import { getMenuColumns } from 'src/config/grid-defs/menuColDefs';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import type { Menu } from 'src/config/types/Menu';
import type { WithCrud } from 'src/config/types/GridTypes';
import type { PrimeTreeNode, ApiNode } from 'src/utils/treeUtils';
import { useAuthStore } from 'src/store/authStore';

type MenuApiNode = ApiNode<Menu> & WithCrud<Menu>;
type MenuTreeNode = PrimeTreeNode<Menu>;

export default function MenuTable() {
  const toastRef = useRef<Toast | null>(null);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

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
  } = useTreeTable<Menu>({
    apiBaseUrl: '/system/menu',
    idField: 'menuId',
    parentIdField: 'parentMenuId',
    parentObjectField: 'parent',
    toastRef,
    newRowDefaults: {
      menuNm: '',
      menuCd: '',
      menuPath: '/',
      icon: 'pi pi-file',
      sortOrder: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const handleAddChild = useCallback(
    (node: MenuTreeNode) => {
      addChildNode(node);
    },
    [addChildNode],
  );

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">메뉴 관리</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadNodes}
        className="p-button-sm"
        outlined
      />
    </div>
  );

  const columns = useMemo(
    () =>
      getMenuColumns({
        editingKey,
        editingRowData: editingRowData as MenuApiNode,
        onEditDataChange: setEditingData,
        startEdit,
        cancelEdit,
        saveEdit,
        deleteNode,
        onAddChild: handleAddChild,
        permissions: permissionSet,
        menuTreeNodes: nodes,
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
            useAddRootButton={permissionSet.canCreate}
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
