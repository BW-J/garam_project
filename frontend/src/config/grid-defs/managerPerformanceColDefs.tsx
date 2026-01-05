import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Performance } from 'src/config/types/Commission';

interface ManagerProps {
  canEdit: boolean; // 수정 가능 기간 여부
  onEditIqa: (data: Performance) => void;
  onAddAdjustment: (data: Performance) => void;
}

const currencyBody = (val: number) => Number(val || 0).toLocaleString('ko-KR');

export const getManagerPerformanceColumns = ({
  canEdit,
  onEditIqa,
  onAddAdjustment,
}: ManagerProps) => {
  const columns = [
    <Column
      key="yearMonth"
      field="yearMonth"
      header="귀속월"
      sortable
      style={{ minWidth: '4rem' }}
    />,
    <Column
      key="userNm"
      field="user.userNm"
      header="성명"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="이름 검색"
      style={{ minWidth: '6rem' }}
    />,
    <Column
      key="deptNm"
      field="user.department.deptNm"
      header="부서"
      sortable
      style={{ minWidth: '4rem' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="posNm"
      field="user.position.positionNm"
      header="직급"
      sortable
      style={{ minWidth: '4rem' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,

    <Column
      key="iqa"
      field="iqaMaintenanceRate"
      header="IQA"
      sortable
      style={{ minWidth: '8rem', textAlign: 'right' }}
      alignHeader={'right'}
      body={(r: Performance) => (
        <div className="flex align-items-center justify-content-end gap-2">
          <span>{r.iqaMaintenanceRate}%</span>
          {canEdit && (
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text p-button-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEditIqa(r);
              }}
              tooltip="IQA 수정"
            />
          )}
        </div>
      )}
    />,

    <Column
      key="settlement"
      field="settlementAmount"
      header="정산금액"
      sortable
      body={(r: any) => currencyBody(r.settlementAmount)}
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right', fontWeight: 'bold' }}
    />,
    <Column
      key="truncated"
      field="truncatedAmount"
      header="절삭금액"
      sortable
      body={(r: any) => currencyBody(r.truncatedAmount)}
      alignHeader={'right'}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
      style={{ minWidth: '8rem', textAlign: 'right', fontWeight: 'bold' }}
    />,

    // 관리 버튼 (조정 추가)
  ];
  if (canEdit) {
    columns.push(
      <Column
        key="action"
        header="관리"
        alignHeader="center"
        style={{ width: '6rem', textAlign: 'center' }}
        body={(r: Performance) => (
          <Button
            icon="pi pi-plus"
            className="p-button-rounded p-button-text p-button-success"
            onClick={(e) => {
              e.stopPropagation();
              onAddAdjustment(r);
            }}
            tooltip="조정 추가"
          />
        )}
      />,
    );
  }

  return columns;
};
