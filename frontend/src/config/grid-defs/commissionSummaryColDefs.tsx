import { Column } from 'primereact/column';
import type { CommissionSummary } from '../types/Commission';
import { Button } from 'primereact/button';

interface SummaryColumnProps {
  mode: 'MANAGE' | 'MY';
  //   commissionType: 'RECRUITMENT' | 'PROMOTION_BONUS';
  //   title: string;
  onAdjust: (rowData: CommissionSummary) => void;
}

const currencyBody = (rowData: CommissionSummary) => {
  return Number(rowData.totalAmount).toLocaleString('ko-KR') + ' 원';
};

export const getCommissionSummaryColumns = ({ mode, onAdjust }: SummaryColumnProps) => {
  const columns = [
    <Column
      key="yearMonth"
      field="yearMonth"
      header="귀속월"
      sortable
      style={{ minWidth: '8rem' }}
    />,
  ];

  if (mode === 'MANAGE') {
    columns.push(
      <Column
        field="userNm"
        header="성명"
        sortable
        filter
        style={{ minWidth: '8rem' }}
        filterPlaceholder="이름 검색"
        showFilterMenu={false}
        showClearButton={false}
        filterMatchMode="contains"
      />,
      <Column field="loginId" header="ID" sortable className="hidden-on-mobile" />,
      <Column field="deptNm" header="부서" sortable className="hidden-on-mobile" />,
      <Column field="positionNm" header="직급" sortable className="hidden-on-mobile" />,
    );
  }
  columns.push(
    <Column
      field="totalAmount"
      header={mode === 'MANAGE' ? '총 지급액' : '실 지급액'}
      sortable
      alignHeader={'right'}
      body={currencyBody}
      style={{ fontWeight: 'bold', minWidth: '8rem', textAlign: 'right' }}
    />,
  );
  if (mode === 'MANAGE') {
    columns.push(
      <Column
        key="actions"
        header="조정"
        alignHeader={'center'}
        body={(rowData: CommissionSummary) => (
          <Button
            icon="pi pi-pencil"
            text
            onClick={(e) => {
              e.stopPropagation(); // 행 클릭(상세보기) 방지
              onAdjust(rowData);
            }}
          />
        )}
        style={{ minWidth: '3rem', textAlign: 'center' }}
      />,
    );
  }

  return columns;
};
