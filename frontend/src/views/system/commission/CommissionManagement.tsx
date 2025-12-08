import { TabPanel, TabView } from 'primereact/tabview';
import CommissionSummaryView from './CommissionSummaryView';
import ManagerPerformanceDataTable from './ManagerPerformanceDataTable';

/**
 * 수당 관리 통합 페이지 (관리자용)
 */
const CommissionManagement = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1">
        <TabPanel header="실적 데이터 관리 (업로드/수정/계산)">
          <ManagerPerformanceDataTable />
        </TabPanel>
        <TabPanel header="[요약] 증원 수수료">
          <CommissionSummaryView
            mode="MANAGE"
            commissionType="RECRUITMENT"
            title="증원 수수료 (관리자)"
          />
        </TabPanel>
        <TabPanel header="[요약] 승진 축하금">
          <CommissionSummaryView
            mode="MANAGE"
            commissionType="PROMOTION_BONUS"
            title="승진 축하금 (관리자)"
          />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default CommissionManagement;
