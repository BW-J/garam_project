import { Column } from 'primereact/column';
import type { ColumnBodyOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Action } from 'src/config/types/Action';
import type { WithCrud } from 'src/config/types/GridTypes';
import {
  booleanFilterTemplate,
  datatableTextEditor,
  datatableBooleanEditor,
} from 'src/utils/gridTemplates';
import type { PermissionSet } from 'src/utils/permissionUtils';

type ActionRow = WithCrud<Action>;

interface ActionColumnProps {
  deleteRow: (row: ActionRow) => void;
  permissions?: PermissionSet;
  onAddRoot?: () => void;
}

const booleanBody = (rowData: ActionRow) => (rowData.isActive ? '사용' : '미사용');

export const getActionColumns = ({ deleteRow, permissions, onAddRoot }: ActionColumnProps) => {
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;
  const canCreate = !!permissions?.canCreate;

  const actionTemplate = (rowData: ActionRow, options: ColumnBodyOptions) => {
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
      key="actionNm"
      field="actionNm"
      header="액션명"
      sortable
      filter
      filterPlaceholder="액션명 검색"
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      editor={canEdit ? datatableTextEditor : undefined}
      style={{ textAlign: 'center' }}
      headerClassName="text-center"
    />,
    <Column
      key="actionCd"
      field="actionCd"
      header="관리코드"
      sortable
      filter
      filterPlaceholder="코드 검색"
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      editor={canEdit ? datatableTextEditor : undefined}
    />,
    <Column
      key="actionDesc"
      field="actionDesc"
      header="설명"
      editor={canEdit ? datatableTextEditor : undefined}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '15rem' }}
    />,
    <Column
      key="isActive"
      field="isActive"
      header="상태"
      showFilterMenu={false}
      showClearButton={false}
      body={booleanBody}
      filterMatchMode="equals"
      editor={canEdit ? datatableBooleanEditor : undefined}
      style={{ width: '6rem', textAlign: 'center' }}
      filter
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
        headerClassName="text-center"
        filterElement={
          <div className="flex justify-content-center p-0 m-0">
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
      />,
    );
  }

  return columns;
};
