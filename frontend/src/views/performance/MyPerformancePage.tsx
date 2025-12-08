import { TabPanel, TabView } from 'primereact/tabview';
import MyPerformanceDataTable from '../system/commission/MyPerformnaceDataTable';
import DownlinePerformanceDataTable from '../system/commission/DownlinePerformanceDataTable';

export default function MyPerformancePage() {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1" renderActiveOnly={true}>
        <TabPanel header="내 실적">
          <MyPerformanceDataTable />
        </TabPanel>
        <TabPanel header="하위 조직 실적">
          <DownlinePerformanceDataTable />
        </TabPanel>
      </TabView>
    </div>
  );
}
