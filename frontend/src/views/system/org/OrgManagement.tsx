import { TabPanel, TabView } from 'primereact/tabview';
import DepartmentTable from 'src/views/system/org/DepartmentTable';
import PositionTable from 'src/views/system/org/PositionTable';

/**
 * 부서/직급 통합 관리 페이지
 * - DepartmentTable (TreeTable, col-8)
 * - PositionTable (DataTable, col-4)
 */
const OrgManagement = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1 h-full">
        <TabPanel header="부서 관리">
          <DepartmentTable />
        </TabPanel>
        <TabPanel header="직급 관리">
          <PositionTable />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default OrgManagement;
