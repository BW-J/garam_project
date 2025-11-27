import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import type { User } from 'src/config/types/User';
import type { WithCrud } from 'src/config/types/GridTypes';
import { booleanFilterTemplate } from 'src/utils/gridTemplates';
import type { PermissionSet } from 'src/utils/permissionUtils';

type UserRow = WithCrud<User>;

interface UserColumnProps {
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onRestore: (user: UserRow) => void;
  permissions?: PermissionSet;
}

const activeBody = (rowData: UserRow) => {
  return rowData.isActive ? (
    <Tag severity="success" value="활성" />
  ) : (
    <Tag severity="warning" value="비활성" />
  );
};

const deletedBody = (rowData: UserRow) => {
  return rowData.deletedAt ? <Tag severity="danger" value="삭제됨" /> : '';
};

const deptBody = (rowData: UserRow) => rowData.department?.deptNm || '-';
const posBody = (rowData: UserRow) => rowData.position?.positionNm || '-';
const recommenderBody = (rowData: UserRow) => rowData.recommender?.userNm || '-';

export const getUserColumns = ({ onEdit, onDelete, onRestore, permissions }: UserColumnProps) => {
  const canEdit = !!permissions?.canEdit;
  const canDelete = !!permissions?.canDelete;

  const actionTemplate = (rowData: UserRow) => {
    return (
      <div className="flex gap-2 justify-content-center align-items-center">
        {canEdit && (
          <Button
            icon="pi pi-pencil"
            className="p-button-sm p-button-secondary"
            onClick={() => onEdit(rowData)}
            text
            disabled={!!rowData.deletedAt}
          />
        )}

        {canDelete && !rowData.deletedAt && (
          // 삭제되지 않았을 때 -> 삭제 버튼
          <Button
            icon={'pi pi-trash'}
            className="p-button-danger p-button-sm"
            onClick={() => onDelete(rowData)}
            text
          />
        )}
        {canDelete && rowData.deletedAt && (
          // 삭제되었을 때 -> 복구 버튼
          <Button
            icon={'pi pi-undo'}
            className="p-button-success p-button-sm" // 복구 버튼 (초록색)
            onClick={() => onRestore(rowData)}
            text
          />
        )}
      </div>
    );
  };

  const columns = [
    <Column
      key="userId"
      field="userId"
      header="ID"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="ID 검색"
      //style={{ minWidth: '1rem' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="loginId"
      field="loginId"
      header="로그인 ID"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="ID 검색"
      style={{ minWidth: '10rem' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="userNm"
      field="userNm"
      header="사용자명"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="이름 검색"
      style={{ minWidth: '10rem' }}
    />,
    <Column
      key="cellPhone"
      field="cellPhone"
      header="핸드폰 번호"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="번호 검색"
      style={{ minWidth: '10rem' }}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
    <Column
      key="department"
      field="department.deptNm"
      header="부서"
      body={deptBody}
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="부서 검색"
      style={{ minWidth: '10rem' }}
    />,
    <Column
      key="position"
      field="position.positionNm"
      header="직급"
      body={posBody}
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="직급 검색"
      style={{ minWidth: '10rem' }}
    />,
    <Column
      key="recommender"
      field="recommender.userNm"
      header="추천인"
      body={recommenderBody}
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="추천인 검색"
      style={{ minWidth: '10rem' }}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
    <Column
      key="isActive"
      field="isActive"
      header="활성화 여부"
      body={activeBody}
      filterMatchMode="equals"
      style={{ minWidth: '6rem', textAlign: 'center' }}
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterElement={booleanFilterTemplate} // (주의: 이 필터는 '활성/비활성'만 필터링)
    />,
    <Column
      key="deletedAt"
      field="deletedAt"
      header="삭제 여부"
      body={deletedBody}
      style={{ minWidth: '8rem', textAlign: 'center' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
  ];

  if (canEdit || canDelete) {
    columns.push(
      <Column
        key="actions"
        header="관리"
        body={actionTemplate}
        style={{ width: '6rem', textAlign: 'center' }}
      />,
    );
  }

  return columns;
};
