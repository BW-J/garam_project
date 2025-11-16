import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Department } from 'src/config/types/Department';
import type { WithCrud } from 'src/config/types/GridTypes';
import type { PrimeTreeNode } from 'src/utils/treeUtils';
import {
  textEditorTemplate,
  numberEditorTemplate,
  booleanDropdownEditorTemplate,
  treeSelectEditorTemplate,
  TreeTableBooleanFilter,
} from 'src/utils/gridTemplates';
import type { PermissionSet } from 'src/utils/permissionUtils';
import type { TreeTableFilterMeta } from 'primereact/treetable';

type DeptApiNode = Department & WithCrud<Department>;
type DeptTreeNode = PrimeTreeNode<Department>;

interface DepartmentColumnProps {
  editingKey: string | undefined;
  editingRowData: DeptApiNode | undefined;
  onEditDataChange: (field: keyof (Department & WithCrud<Department>) | string, value: any) => void;
  startEdit: (node: DeptTreeNode) => void;
  cancelEdit: () => void;
  saveEdit: (node: DeptTreeNode) => void;
  deleteNode: (node: DeptTreeNode) => void;
  onAddChild: (node: DeptTreeNode) => void;
  deptTreeNodes: PrimeTreeNode<Department>[];
  permissions?: PermissionSet;
  filters: TreeTableFilterMeta;
  onFilter: (filters: TreeTableFilterMeta) => void;
  onAddRoot?: () => void;
}

export const getDepartmentColumns = ({
  editingKey,
  editingRowData,
  onEditDataChange,
  startEdit,
  cancelEdit,
  saveEdit,
  deleteNode,
  onAddChild,
  permissions,
  deptTreeNodes,
  filters,
  onFilter,
  onAddRoot,
}: DepartmentColumnProps) => {
  const editorOptions = { editingKey, editingRowData, onEditDataChange };
  const canCreate = !!permissions?.canCreate;
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;

  const actionTemplate = (node: DeptTreeNode) => {
    const isActive = node.data.isActive;
    if (editingKey === node.key) {
      return (
        <div className="flex gap-2 justify-content-center">
          {canEdit && (
            <Button
              icon="pi pi-check"
              className="p-button-sm"
              onClick={() => saveEdit(node)}
              text
            />
          )}
          {canEdit && (
            <Button icon="pi pi-times" className="p-button-sm" onClick={cancelEdit} text />
          )}
        </div>
      );
    }
    return (
      <div className="flex gap-2 justify-content-center">
        {canEdit && (
          <Button
            icon="pi pi-pencil"
            className="p-button-sm"
            onClick={() => startEdit(node)}
            text
          />
        )}
        {canCreate && (
          <Button
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => onAddChild(node)}
            text
          />
        )}
        {canDelete && (
          <Button
            icon={isActive ? 'pi pi-trash' : 'pi pi-undo'}
            className="p-button-danger p-button-sm"
            onClick={() => deleteNode(node)}
            text
          />
        )}
      </div>
    );
  };

  const columns = [
    <Column
      key="deptNm"
      field="deptNm"
      header="부서명"
      expander
      sortable
      filter
      filterPlaceholder="부서 검색"
      filterMatchMode="contains"
      body={(node: DeptTreeNode) =>
        textEditorTemplate<DeptApiNode>({ ...editorOptions, node, field: 'deptNm' })
      }
      style={{ minWidth: '12rem' }}
    />,
    <Column
      key="deptCd"
      field="deptCd"
      header="관리코드"
      sortable
      filter
      filterPlaceholder="코드 검색"
      filterMatchMode="contains"
      body={(node: DeptTreeNode) =>
        textEditorTemplate<DeptApiNode>({ ...editorOptions, node, field: 'deptCd' })
      }
      style={{ minWidth: '6rem', textAlign: 'center' }}
    />,
    <Column
      key="parentDept"
      field="parent.deptNm"
      header="상위부서"
      sortable
      filter
      filterPlaceholder="상위부서 검색"
      filterMatchMode="contains"
      body={(node: DeptTreeNode) =>
        treeSelectEditorTemplate<DeptApiNode>({
          ...editorOptions,
          node,
          field: 'parentDeptId',
          options: deptTreeNodes,
          optionLabel: 'deptNm',
          displayObjectField: 'parent',
          displayObjectLabelField: 'deptNm',
        })
      }
      style={{ minWidth: '6rem', textAlign: 'center' }}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
    <Column
      key="sortOrder"
      field="sortOrder"
      header="순서"
      sortable
      body={(node: DeptTreeNode) =>
        numberEditorTemplate<DeptApiNode>({ ...editorOptions, node, field: 'sortOrder' })
      }
      style={{ width: '6rem', textAlign: 'center' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,

    <Column
      key="isActive"
      field="isActive"
      header="상태"
      filter
      filterField="isActive"
      filterElement={
        <TreeTableBooleanFilter field="isActive" filters={filters} onFilter={onFilter} />
      }
      body={(node: DeptTreeNode) =>
        booleanDropdownEditorTemplate<DeptApiNode>({ ...editorOptions, node, field: 'isActive' })
      }
      style={{ width: '6rem', textAlign: 'center' }}
      filterMatchMode="equals"
    />,
  ];

  if (canCreate || canEdit || canDelete) {
    columns.push(
      <Column
        key="action"
        header="관리"
        body={actionTemplate}
        style={{ width: '12rem', textAlign: 'center' }}
        filter
        filterElement={
          <div className="flex justify-content-center p-0 m-0">
            {canCreate && onAddRoot && (
              <Button
                icon="pi pi-plus"
                className="p-button-success p-button-sm"
                onClick={onAddRoot}
                text
                aria-label="루트 메뉴 추가"
              />
            )}
          </div>
        }
      />,
    );
  }

  return columns;
};
