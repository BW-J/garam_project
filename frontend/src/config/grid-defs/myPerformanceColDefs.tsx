import { Column } from 'primereact/column';
import type { Performance } from 'src/config/types/Commission';

const currencyBody = (val: number) => Number(val || 0).toLocaleString('ko-KR');

export const getMyPerformanceColumns = () => {
  return [
    <Column key="yearMonth" field="yearMonth" header="귀속 월" style={{ minWidth: '4rem' }} />,
    <Column
      key="iqa"
      field="iqaMaintenanceRate"
      header="IQA"
      sortable
      body={(r: Performance) => `${r.iqaMaintenanceRate}%`}
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right' }}
    />,
    <Column
      key="settlement"
      field="settlementAmount"
      header="정산금액"
      sortable
      alignHeader={'right'}
      body={(r: any) => currencyBody(r.settlementAmount)}
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
    // 상세 보기 버튼은 별도 컬럼 없이 행 클릭으로 처리하므로 여기선 생략하거나 안내 아이콘 정도만 배치 가능
  ];
};
