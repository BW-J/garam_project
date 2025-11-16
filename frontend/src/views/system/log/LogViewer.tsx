import { TabPanel, TabView } from 'primereact/tabview';
import ActivityLogTable from 'src/views/system/log/ActivityLogTable';
import AuditLogTable from 'src/views/system/log/AuditLogTable';

/**
 * 로그 뷰어 통합 페이지
 */
const LogViewer = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1 h-full">
        <TabPanel header="행위 로그 (Activity)">
          <ActivityLogTable />
        </TabPanel>
        <TabPanel header="감사 로그 (Audit)">
          <AuditLogTable />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default LogViewer;
