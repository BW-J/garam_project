import { TabPanel, TabView } from 'primereact/tabview';
import PromotionCandidateList from './PromotionCandidateList';

const PromotionManagement = () => {
  return (
    <div className="page-flex-container">
      <TabView className="flex-grow-1 ">
        <TabPanel header="본부장 승진 대상자">
          <PromotionCandidateList targetPosition="MANAGER" />
        </TabPanel>
        <TabPanel header="지사장 승진 대상자">
          <PromotionCandidateList targetPosition="DIRECTOR" />
        </TabPanel>
      </TabView>
    </div>
  );
};

export default PromotionManagement;
