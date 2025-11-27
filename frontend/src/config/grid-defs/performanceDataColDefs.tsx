import { Column } from 'primereact/column';
import type { WithCrud } from 'src/config/types/GridTypes';
import { datatableNumberEditor } from 'src/utils/gridTemplates';
import type { PerformanceData } from '../types/Commission';

type PerformanceRow = WithCrud<PerformanceData>;

// 숫자(원) 포맷팅
const currencyBody = (rowData: PerformanceRow, field: keyof PerformanceRow) => {
  const value = Number(rowData[field] || 0);
  return value.toLocaleString('ko-KR') + ' 원';
};

// IQA 유지율 포맷팅 (95.50 -> 95.50%)
const iqaBody = (rowData: PerformanceRow) => {
  const rate = Number(rowData.iqaMaintenanceRate || 0);
  return isNaN(rate) ? '-' : `${rate.toFixed(2)} %`;
};

// 관리자용 (편집 가능)
export const getPerformanceDataColumns = (canEdit: boolean) => {
  const columns = [
    <Column
      key="yearMonth"
      field="yearMonth" // JOIN된 이름
      header="해당 월"
      style={{ minWidth: '4rem' }}
    />,
    <Column
      key="user.userNm"
      field="user.userNm" // JOIN된 이름
      header="사용자명"
      sortable
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="이름 검색"
      style={{ minWidth: '6rem' }}
    />,
    ,
    <Column
      key="insurancePremium"
      field="insurancePremium"
      header="보험료"
      sortable
      alignHeader={'right'}
      body={(rowData) => currencyBody(rowData, 'insurancePremium')}
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    <Column
      key="withdrawal"
      field="withdrawal"
      header="철회"
      sortable
      alignHeader={'right'}
      body={(rowData) => currencyBody(rowData, 'withdrawal')}
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    <Column
      key="cancellation"
      field="cancellation"
      header="해지"
      sortable
      alignHeader={'right'}
      body={(rowData) => currencyBody(rowData, 'cancellation')}
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    <Column
      key="lapse"
      field="lapse"
      header="실효"
      sortable
      alignHeader={'right'}
      body={(rowData) => currencyBody(rowData, 'lapse')}
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    <Column
      key="iqaMaintenanceRate"
      field="iqaMaintenanceRate"
      header="IQA 유지율"
      sortable
      body={iqaBody}
      alignHeader={'right'}
      editor={canEdit ? datatableNumberEditor : undefined}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    // (이하 읽기 전용)
    <Column
      key="settlementAmount"
      field="settlementAmount"
      header="정산금액"
      sortable
      alignHeader={'right'}
      body={(rowData) => currencyBody(rowData, 'settlementAmount')}
      style={{ minWidth: '8rem', textAlign: 'right', fontWeight: 'bold' }}
    />,
    <Column
      key="truncatedAmount"
      field="truncatedAmount"
      header="절삭금액"
      sortable
      body={(rowData) => currencyBody(rowData, 'truncatedAmount')}
      alignHeader={'right'}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
      style={{ minWidth: '8rem', textAlign: 'right', fontWeight: 'bold' }}
    />,
  ];
  if (canEdit) {
    columns.push(
      <Column
        key="rowEditor"
        rowEditor={canEdit}
        header="수정"
        bodyStyle={{ textAlign: 'center' }}
        style={{ width: '5rem' }}
      />,
    );
  }
  return columns;
};
