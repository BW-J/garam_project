import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import type { Performance } from 'src/config/types/Commission';

interface SummaryProps {
  mode: 'MANAGE' | 'MY';
  isEditable: boolean;
  onDetail: (data: Performance) => void;
  onEditIqa: (data: Performance) => void; // IQA 수정 핸들러
  onAddAdjustment: (data: Performance) => void; // 조정 추가 핸들러
}

const currencyBody = (rowData: Performance, field: keyof Performance) => {
  return Number(rowData[field] || 0).toLocaleString('ko-KR');
};

export const getPerformanceSummaryColumns = ({
  mode,
  isEditable,
  onEditIqa,
  onAddAdjustment,
}: SummaryProps) => {
  const columns = [
    <Column
      key="yearMonth"
      field="yearMonth"
      header="귀속월"
      sortable
      style={{ textAlign: 'center' }}
    />,
  ];

  if (mode === 'MANAGE') {
    columns.push(
      <Column
        key="userNm"
        field="user.userNm"
        header="성명"
        sortable
        filter
        showFilterMenu={false}
        showClearButton={false}
        style={{ textAlign: 'center' }}
      />,
      <Column
        key="deptNm"
        field="user.department.deptNm"
        header="부서"
        sortable
        className="hidden-on-mobile"
        style={{ textAlign: 'center' }}
      />,
      <Column
        key="posNm"
        field="user.position.positionNm"
        header="직급"
        sortable
        className="hidden-on-mobile"
        style={{ textAlign: 'center' }}
      />,
    );
  }

  // IQA 컬럼 (관리자 & 수정 가능 기간이면 수정 버튼 표시)
  columns.push(
    <Column
      key="iqa"
      field="iqaMaintenanceRate"
      header="IQA"
      sortable
      align="center"
      body={(r: Performance) => (
        <div className="flex align-items-center justify-content-center gap-2">
          <span>{r.iqaMaintenanceRate}%</span>
          {mode === 'MANAGE' && isEditable && (
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
  );

  columns.push(
    <Column
      key="settlement"
      field="settlementAmount"
      header="정산금액"
      sortable
      body={(r: any) => currencyBody(r, 'settlementAmount')}
      align="right"
    />,
    <Column
      key="truncated"
      field="truncatedAmount"
      header="절삭금액"
      sortable
      body={(r: any) => currencyBody(r, 'truncatedAmount')}
      align="right"
      style={{ fontWeight: 'bold' }}
    />,
  );

  // 관리 버튼
  columns.push(
    <Column
      key="action"
      header="관리"
      alignHeader="center"
      style={{ width: '8rem', textAlign: 'center' }}
      body={(r: Performance) => (
        <div className="flex justify-content-center gap-1">
          {/* 조정 추가 버튼 (관리자 & 수정가능 기간) */}
          {mode === 'MANAGE' && isEditable && (
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
        </div>
      )}
    />,
  );

  return columns;
};
