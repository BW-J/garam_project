import MenuTable from 'src/views/system/resource/MenuTable';
import ActionTable from 'src/views/system/resource/ActionTable';
import { TabPanel, TabView } from 'primereact/tabview';

/**
 * 메뉴/액션 통합 관리 페이지
 * - MenuTable (TreeTable, col-8)
 * - ActionTable (DataTable, col-4)
 */
const ResourceManagement = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1 h-full">
        <TabPanel header="메뉴 관리">
          <MenuTable />
        </TabPanel>
        <TabPanel header="행동 관리">
          <ActionTable />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default ResourceManagement;
