import GenealogyChart from './GenealogyChart';
import MainChart from './MainChart';
import MyMonthlySummary from './MyMonthlySummary';

const Dashboard = () => {
  return (
    <div className="grid h-full">
      {/* --- [월별 추이 차트] --- */}
      <div className="col-12 lg:col-9 flex">
        <MainChart />
      </div>
      {/* --- [신규] 월별 요약 --- */}
      <div className="col-12 lg:col-3 flex">
        <MyMonthlySummary />
      </div>

      {/* --- 계보도 차트 --- */}
      <div className="col-12">
        <GenealogyChart />
      </div>

      {/* --- [수정] 기존 예제 카드 모두 제거 --- */}
    </div>
  );
};

export default Dashboard;
