import { TabView, TabPanel } from 'primereact/tabview';
import AssignmentPanel from 'src/views/system/assignment/AssignmentPanel';

/**
 * 역할 할당 관리 페이지
 * - 1. 사용자-역할 매핑
 * - 2. 직급-역할 매핑
 */
const RoleAssignment = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1">
        {/* --- 1. 사용자-역할 할당 탭 --- */}
        <TabPanel header="사용자-역할 할당">
          <AssignmentPanel
            subjectTitle="사용자"
            subjectListTitle="사용자 목록"
            subjectApiUrl="/system/users"
            roleMapApiUrlPrefix="/system/user-role"
            subjectIdField="userId"
            subjectLabelField="userNm"
          />
        </TabPanel>

        {/* --- 2. 직급-역할 할당 탭 --- */}
        <TabPanel header="직급-역할 할당">
          <AssignmentPanel
            subjectTitle="직급"
            subjectListTitle="직급 목록"
            subjectApiUrl="/system/position"
            roleMapApiUrlPrefix="/system/position-role"
            subjectIdField="positionId"
            subjectLabelField="positionNm"
          />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default RoleAssignment;
