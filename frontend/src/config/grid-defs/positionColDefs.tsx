import { Column } from 'primereact/column';
import type { ColumnBodyOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Position } from 'src/config/types/Position';
import type { WithCrud } from 'src/config/types/GridTypes';
import {
  booleanFilterTemplate,
  datatableBooleanEditor,
  datatableNumberEditor,
  datatableTextEditor,
} from 'src/utils/gridTemplates';
import type { PermissionSet } from 'src/utils/permissionUtils';

type PosRow = WithCrud<Position>;

interface PositionColumnProps {
  deleteRow: (row: PosRow) => void;
  permissions?: PermissionSet;
  onAddRoot?: () => void;
}

const booleanBody = (rowData: PosRow) => (rowData.isActive ? '사용' : '미사용');
// --- ---

export const getPositionColumns = ({ deleteRow, permissions, onAddRoot }: PositionColumnProps) => {
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;
  const canCreate = !!permissions?.canCreate;

  const actionTemplate = (rowData: PosRow, options: ColumnBodyOptions) => {
    // options.rowEditor.element가 '연필' 또는 'V/X' 아이콘을 포함합니다.
    const editorElement = options.rowEditor?.element;

    return (
      <div className="flex gap-2 justify-content-center align-items-center">
        {/* 1. PrimeReact의 기본 편집/저장/취소 버튼 렌더링 */}
        {canEdit && editorElement}

        {/* 2. 커스텀 삭제/복구 버튼 렌더링 */}
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
      key="positionNm"
      field="positionNm"
      header="직급명"
      sortable
      filter
      filterPlaceholder="직급 검색"
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      editor={canEdit ? datatableTextEditor : undefined}
    />,
    <Column
      key="positionCd"
      field="positionCd"
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
      key="sortOrder"
      field="sortOrder"
      header="순서"
      sortable
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ width: '6rem', textAlign: 'center' }}
      headerClassName="hidden-on-mobile text-center"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="isActive"
      field="isActive"
      header="상태"
      showFilterMenu={false}
      showClearButton={false}
      headerClassName="text-center"
      body={booleanBody}
      filterMatchMode="equals"
      editor={canEdit ? datatableBooleanEditor : undefined}
      style={{ width: '6rem', textAlign: 'center' }}
      filter
      filterElement={booleanFilterTemplate}
    />,
  ];

  if (canEdit || canDelete || canCreate) {
    columns.push(
      <Column
        key="rowEditor"
        rowEditor={canEdit} // 편집(V/X) 버튼
        header="관리"
        body={actionTemplate} // 삭제/복구 버튼
        style={{ width: '8rem', textAlign: 'center' }}
        headerClassName="text-center"
        filter
        showFilterMenu={false}
        showClearButton={false}
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
