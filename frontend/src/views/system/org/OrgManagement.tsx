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
          {/* 👇 불필요한 중간 div 제거하고 컴포넌트 직접 배치 */}
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
