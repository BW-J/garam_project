import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Menu } from 'src/config/types/Menu';
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

type MenuApiNode = Menu & WithCrud<Menu>;
type MenuTreeNode = PrimeTreeNode<Menu>;

interface MenuColumnProps {
  editingKey: string | undefined;
  editingRowData: MenuApiNode | undefined;
  onEditDataChange: (field: keyof (Menu & WithCrud<Menu>) | string, value: any) => void;
  startEdit: (node: MenuTreeNode) => void;
  cancelEdit: () => void;
  saveEdit: (node: MenuTreeNode) => void;
  deleteNode: (node: MenuTreeNode) => void;
  onAddChild: (node: MenuTreeNode) => void;
  menuTreeNodes: PrimeTreeNode<Menu>[];
  permissions?: PermissionSet;
  filters: TreeTableFilterMeta;
  onFilter: (filters: TreeTableFilterMeta) => void;
  onAddRoot?: () => void;
}

export const getMenuColumns = ({
  editingKey,
  editingRowData,
  onEditDataChange,
  startEdit,
  cancelEdit,
  saveEdit,
  deleteNode,
  onAddChild,
  onAddRoot,
  permissions,
  menuTreeNodes,
  filters,
  onFilter,
}: MenuColumnProps) => {
  const editorOptions = { editingKey, editingRowData, onEditDataChange };
  const canCreate = !!permissions?.canCreate;
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;

  const actionTemplate = (node: MenuTreeNode) => {
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
            <Button
              icon="pi pi-times"
              className="p-button-secondary p-button-sm"
              onClick={cancelEdit}
              text
            />
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
          <Button icon="pi pi-plus" className="p-button-sm" onClick={() => onAddChild(node)} text />
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
      key="menuNm"
      field="menuNm"
      header="메뉴명"
      expander
      sortable
      filter
      filterPlaceholder="메뉴 검색"
      filterMatchMode="contains"
      style={{ minWidth: '15rem' }}
      body={(node: MenuTreeNode) =>
        textEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'menuNm' })
      }
    />,
    <Column
      key="menuCd"
      field="menuCd"
      header="관리코드"
      sortable
      filter
      filterPlaceholder="코드 검색"
      filterMatchMode="contains"
      style={{ minWidth: '10rem' }}
      body={(node: MenuTreeNode) =>
        textEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'menuCd' })
      }
    />,
    <Column
      key="menuPath"
      field="menuPath"
      header="경로 (Path)"
      body={(node: MenuTreeNode) =>
        textEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'menuPath' })
      }
    />,
    <Column
      key="icon"
      field="icon"
      header="아이콘"
      style={{ minWidth: '8rem' }}
      body={(node: MenuTreeNode) =>
        textEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'icon' })
      }
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
    <Column
      key="parentMenu"
      field="parent.menuNm"
      header="상위메뉴"
      sortable
      filter
      filterPlaceholder="상위메뉴 검색"
      filterMatchMode="contains"
      body={(node: MenuTreeNode) =>
        treeSelectEditorTemplate<MenuApiNode>({
          ...editorOptions,
          node,
          field: 'parentMenuId',
          options: menuTreeNodes,
          optionLabel: 'menuNm',
          displayObjectField: 'parent',
          displayObjectLabelField: 'menuNm',
        })
      }
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="sortOrder"
      field="sortOrder"
      header="순서"
      sortable
      body={(node: MenuTreeNode) =>
        numberEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'sortOrder' })
      }
      style={{ width: '6rem', textAlign: 'center' }}
      headerClassName="hidden-on-mobile text-center"
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
      body={(node: MenuTreeNode) =>
        booleanDropdownEditorTemplate<MenuApiNode>({ ...editorOptions, node, field: 'isActive' })
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
