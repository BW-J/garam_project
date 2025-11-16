import { Column } from 'primereact/column';
import type { ColumnBodyOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Role } from 'src/config/types/Role';
import type { WithCrud } from 'src/config/types/GridTypes';
import {
  booleanFilterTemplate,
  datatableTextEditor,
  datatableBooleanEditor,
} from 'src/utils/gridTemplates';
import type { PermissionSet } from 'src/utils/permissionUtils';

type RoleRow = WithCrud<Role>;

interface RoleColumnProps {
  deleteRow: (row: RoleRow) => void;
  permissions?: PermissionSet;
  onAddRoot?: () => void;
}

const booleanBody = (rowData: RoleRow) => (rowData.isActive ? '사용' : '미사용');

export const getRoleColumns = ({ deleteRow, permissions, onAddRoot }: RoleColumnProps) => {
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;
  const canCreate = !!permissions?.canCreate;

  const actionTemplate = (rowData: RoleRow, options: ColumnBodyOptions) => {
    const editorElement = options.rowEditor?.element;
    return (
      <div className="flex gap-2 justify-content-center align-items-center">
        {canEdit && editorElement}
        {canDelete && (
          <Button
            icon={rowData.isActive ? 'pi pi-trash' : 'pi pi-undo'}
            className="p-button-danger p-button-sm"
            onClick={() => deleteRow(rowData)}
            text
          />
        )}
      </div>
    );
  };

  const columns = [
    <Column
      key="roleNm"
      field="roleNm"
      header="역할명"
      sortable
      filter
      filterPlaceholder="역할명 검색"
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      editor={canEdit ? datatableTextEditor : undefined}
      style={{ textAlign: 'center', minWidth: '8rem' }}
      headerClassName="text-center"
    />,
    <Column
      key="roleCd"
      field="roleCd"
      header="관리코드"
      sortable
      filter
      filterPlaceholder="코드 검색"
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      editor={canEdit ? datatableTextEditor : undefined}
      style={{ textAlign: 'center', minWidth: '8rem' }}
      headerClassName="text-center"
    />,
    <Column
      key="description"
      field="description"
      header="설명"
      editor={canEdit ? datatableTextEditor : undefined}
      headerClassName="hidden-on-tablet  text-center"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '10rem', textAlign: 'center' }}
    />,
    <Column
      key="isActive"
      field="isActive"
      header="상태"
      body={booleanBody}
      filterMatchMode="equals"
      editor={canEdit ? datatableBooleanEditor : undefined}
      style={{ width: '6rem', textAlign: 'center' }}
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterElement={booleanFilterTemplate}
      headerClassName="text-center"
    />,
  ];

  if (canEdit || canDelete || canCreate) {
    columns.push(
      <Column
        key="rowEditor"
        rowEditor={canEdit}
        header="관리"
        body={actionTemplate}
        style={{ width: '8rem', textAlign: 'center' }}
        filter
        showFilterMenu={false}
        showClearButton={false}
        filterElement={
          <div className="flex justify-content-center p-0 m-0 w-full">
            {canCreate && onAddRoot && (
              <Button
                icon="pi pi-plus"
                className="p-button-success p-button-sm"
                onClick={onAddRoot}
                text
                aria-label="행 추가"
              />
            )}
          </div>
        }
        headerClassName="text-center"
      />,
    );
  }

  return columns;
};
