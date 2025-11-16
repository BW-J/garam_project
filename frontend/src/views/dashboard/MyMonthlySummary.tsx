import { useState, useEffect, useCallback } from 'react'; // useMemo 제거 가능
import { Card } from 'primereact/card';
import { Calendar } from 'primereact/calendar';
import { Skeleton } from 'primereact/skeleton';
import { useAuthStore } from 'src/store/authStore';
import api from 'src/api/axios';
import { getDefaultPreviousMonth, toLocalYearMonth } from 'src/utils/dateUtils';

const formatCurrency = (value: number) => {
  return `${value.toLocaleString('ko-KR')} 원`;
};

export default function MyMonthlySummary() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(getDefaultPreviousMonth());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ settlementTotal: 0, commissionTotal: 0 });

  // 슈퍼 어드민 여부만 확인 (라벨 표시용)
  const isSuperAdmin = useAuthStore((state) => state.user?.isSuperAdmin);

  const loadSummary = useCallback(async (month: string | null) => {
    if (!month) return;
    setLoading(true);
    try {
      // 👇 [수정] 신규 통합 API 호출 (권한 체크는 백엔드가 알아서 함)
      const res = await api.get('/system/commission/dashboard', {
        params: { yearMonth: month },
      });
      setSummary({
        settlementTotal: res.data.settlementTotal,
        commissionTotal: res.data.commissionTotal,
      });
    } catch (e) {
      console.error('대시보드 로드 실패', e);
      setSummary({ settlementTotal: 0, commissionTotal: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary(selectedMonth);
  }, [selectedMonth, loadSummary]);

  const onMonthChange = (e: any) => {
    setSelectedMonth(toLocalYearMonth(e.value));
  };

  // ... (renderContent는 기존과 동일하되 라벨만 isSuperAdmin으로 분기)
  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid formgrid mt-2">
          <div className="col-12 lg:col-6">
            <Skeleton height="4rem" />
          </div>
          <div className="col-12 lg:col-6">
            <Skeleton height="4rem" />
          </div>
        </div>
      );
    }
    return (
      <div className="grid formgrid mt-2">
        <div className="col-12 lg:col-6">
          <Card className="h-full">
            <span className="block text-500 font-medium mb-3">
              {/* 👇 라벨 분기 */}
              {selectedMonth} 정산금액 {isSuperAdmin ? '(전체 실적)' : '(본인 실적)'}
            </span>
            <div className="text-900 font-medium text-xl">
              {formatCurrency(summary.settlementTotal)}
            </div>
          </Card>
        </div>
        <div className="col-12 lg:col-6">
          <Card className="h-full">
            <span className="block text-500 font-medium mb-3">
              {selectedMonth} 수당 합계 {isSuperAdmin ? '(전체 지급)' : '(본인 수령)'}
            </span>
            <div className="text-900 font-medium text-xl">
              {formatCurrency(summary.commissionTotal)}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    // ... (Calendar 부분 동일)
    <Card title="월별 실적/수당 요약" className="mb-4">
      <Calendar
        value={selectedMonth ? new Date(selectedMonth) : null}
        onChange={onMonthChange}
        view="month"
        dateFormat="yy-mm"
        placeholder="월 선택"
      />
      {renderContent()}
    </Card>
  );
}
