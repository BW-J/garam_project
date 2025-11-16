import { Card } from 'primereact/card';
// 👇 [수정] 불필요한 임포트 정리 (예제 데이터 제거)
// import { Button } from 'primereact/button';
// import { ProgressBar } from 'primereact/progressbar';
// import { DataTable } from 'primereact/datatable';
// import { Column } from 'primereact/column';
// import { Avatar } from 'primereact/avatar';
// import { Tag } from 'primereact/tag';

import GenealogyChart from './GenealogyChart'; // 계보도
import MyMonthlySummary from './MyMonthlySummary'; // 👈 [신규] 월별 요약

// 👇 [수정] 예제 데이터 및 인터페이스 모두 제거
// import avatar1 from 'src/assets/images/avatars/1.jpg';
// ...
// interface ProgressExampleItem { ... }
// interface TableExampleItem { ... }

const Dashboard = () => {
  // 👇 [수정] 예제 데이터 제거
  // const progressExample: ProgressExampleItem[] = [ ... ];
  // const tableExample: TableExampleItem[] = [ ... ];
  // ... (Body Template 함수들 모두 제거) ...

  return (
    <div className="grid">
      <div className="col-12">
        <Card title="DashBoard" className="mb-4">
          <p>수당 계산 시스템 대시보드입니다.</p>
        </Card>
      </div>

      {/* --- [신규] 월별 요약 --- */}
      <div className="col-12">
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
