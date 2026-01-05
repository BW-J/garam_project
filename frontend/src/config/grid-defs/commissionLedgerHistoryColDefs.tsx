import { Column } from 'primereact/column';
import { Tooltip } from 'primereact/tooltip';
import type { CommissionLedgerHistory } from 'src/config/types/Commission';

// 숫자(원) 포맷팅
const currencyBody = (rowData: CommissionLedgerHistory) => {
  const val = Number(rowData.amount || 0);
  return val.toLocaleString('ko-KR') + ' 원';
};

const detailsBodyTemplate = (rowData: CommissionLedgerHistory) => {
  if (!rowData.details) return null;
  const targetId = `details-tooltip-${rowData.historyId}`;

  return (
    <>
      <Tooltip target={`.${targetId}`} position="top" autoHide={false}>
        <pre className="p-tooltip-pre">{JSON.stringify(rowData.details, null, 2)}</pre>
      </Tooltip>
      <span className={`truncate-cell-content ${targetId}`}>{JSON.stringify(rowData.details)}</span>
    </>
  );
};

export const getCommissionLedgerHistoryColumns = () => {
  return [
    <Column
      key="yearMonth"
      field="yearMonth" // JOIN된 이름
      header="해당 월"
      style={{ minWidth: '4rem' }}
    />,
    <Column
      key="user.userNm"
      field="user.userNm"
      header="수급자"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="수급자 검색"
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
      style={{ minWidth: '8rem' }}
    />,
    <Column
      key="commissionType"
      field="commissionType"
      header="종류"
      sortable
      style={{ minWidth: '6rem' }}
    />,
    <Column
      key="amount"
      field="amount"
      header="금액"
      alignHeader={'right'}
      body={currencyBody}
      sortable
      style={{ minWidth: '8rem', textAlign: 'right', fontWeight: 'bold' }}
    />,
    <Column
      key="sourceUser.userNm"
      field="sourceUser.userNm"
      header="실적 발생자"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="발생자 검색"
      style={{ minWidth: '6rem' }}
    />,
    <Column
      key="details"
      field="details"
      header="계산 근거"
      body={detailsBodyTemplate}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '10rem' }}
    />,
  ];
};
