import { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import api from 'src/api/axios';
import { useAuthStore } from 'src/store/authStore';
import type { Performance, CommissionSummary } from 'src/config/types/Commission';
import { Calendar } from 'primereact/calendar';

/**
 * API 응답 데이터를 월별로 집계하는 헬퍼 함수
 */
const processData = (
  data: Performance[] | CommissionSummary[],
  dateField: string,
  valueField: string,
): Map<string, number> => {
  const monthlyMap = new Map<string, number>();
  for (const item of data) {
    const month = (item as any)[dateField];
    const value = Number((item as any)[valueField]) || 0;
    if (month) {
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + value);
    }
  }
  return monthlyMap;
};

export default function MainChart() {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = useAuthStore((state) => state.user?.isSuperAdmin);
  const [selectedYear, setSelectedYear] = useState<Date | null>(new Date());

  // 1. 관리자/사용자에 따라 제목 변경
  const cardTitle = isSuperAdmin
    ? '전체 월별 실적 및 수수료 추이 (관리자)'
    : '내 월별 실적 및 수수료 추이';

  useEffect(() => {
    const fetchChartData = async () => {
      if (!selectedYear) return;
      setLoading(true);
      try {
        const yearStr = selectedYear.getFullYear().toString(); // "2025"
        // 2. 관리자/사용자에 따라 다른 API 엔드포인트 결정
        const perfEndpoint = isSuperAdmin
          ? '/system/commission/manage/performance' // 관리자용 (전체 실적)
          : '/system/commission/my/performance'; // 사용자용 (내 실적)

        const commEndpoint = isSuperAdmin
          ? '/system/commission/manage/summary' // 관리자용 (전체 수수료)
          : '/system/commission/my/summary'; // 사용자용 (내 수수료)

        // 3. 두 API 병렬 호출 (yearMonth 파라미터 없이 호출 = 전체 이력)
        const [perfRes, commRes] = await Promise.all([
          api.get(perfEndpoint, { params: { year: yearStr } }),
          api.get(commEndpoint, {
            params: { commissionType: 'RECRUITMENT', year: yearStr },
          }),
        ]);

        // 4. 월별 데이터 집계
        // 실적(정산금액) 추이
        const perfMap = processData(perfRes.data, 'yearMonth', 'settlementAmount');
        // 수수료(총 지급액) 추이
        const commMap = processData(commRes.data, 'yearMonth', 'totalAmount');

        // 5. 차트 라벨 (모든 월, 정렬)
        const allMonths = [...new Set([...perfMap.keys(), ...commMap.keys()])].sort();

        // 6. 차트 데이터셋 생성
        const perfValues = allMonths.map((month) => perfMap.get(month) || 0);
        const commValues = allMonths.map((month) => commMap.get(month) || 0);

        // --- PrimeReact Chart.js 데이터 및 옵션 설정 ---
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border');
        const primaryColor = documentStyle.getPropertyValue('--blue-500'); // 실적
        const secondaryColor = documentStyle.getPropertyValue('--green-500'); // 수수료

        const data = {
          labels: allMonths,
          datasets: [
            {
              label: '월별 실적 (정산액)',
              data: perfValues,
              fill: false,
              borderColor: primaryColor,
              tension: 0.4,
            },
            {
              label: '월별 수수료 (수급액)',
              data: commValues,
              fill: false,
              borderColor: secondaryColor,
              tension: 0.4,
            },
          ],
        };

        const options = {
          maintainAspectRatio: false,
          aspectRatio: 0.6,
          plugins: {
            legend: {
              labels: {
                color: textColor,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context: any) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('ko-KR', {
                      style: 'currency',
                      currency: 'KRW',
                    }).format(context.parsed.y);
                  }
                  return label;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: textColorSecondary,
              },
              grid: {
                color: surfaceBorder,
              },
            },
            y: {
              ticks: {
                color: textColorSecondary,
                callback: function (value: number) {
                  return (value / 1000000).toLocaleString('ko-KR') + '백만'; // 단위를 백만으로
                },
              },
              grid: {
                color: surfaceBorder,
              },
            },
          },
        };

        setChartData(data);
        setChartOptions(options);
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [isSuperAdmin, selectedYear]); // isSuperAdmin이 변경될 때 다시 호출

  const header = (
    <div className="flex justify-content-between align-items-center p-3">
      <span className="text-xl font-bold">{cardTitle}</span>
      <Calendar
        value={selectedYear}
        onChange={(e) => setSelectedYear(e.value as Date)}
        view="year"
        dateFormat="yy년"
        // showIcon
        className="w-10rem"
      />
    </div>
  );

  return (
    <Card header={header} className="card-flex-full h-full">
      {loading ? (
        <div className="flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
        </div>
      ) : (
        <div style={{ display: loading ? 'none' : 'block', height: '100%' }}>
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>
      )}
    </Card>
  );
}
