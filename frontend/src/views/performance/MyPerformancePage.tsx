import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import type { PerformanceData } from 'src/config/types/Commission';
import { getPerformanceDataColumns } from 'src/config/grid-defs/performanceDataColDefs';
import api from 'src/api/axios';
import { toLocalYearMonth } from 'src/utils/dateUtils';
import { useAuthStore } from 'src/store/authStore';

export default function MyPerformancePage() {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PerformanceData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const myUserId = useAuthStore((state) => state.user?.userId);

  // 1. 데이터 로드 (백엔드가 토큰으로 필터링)
  const loadRows = useCallback(
    async (month: string | null) => {
      if (!myUserId) return;
      setLoading(true);
      try {
        const params: any = { userId: myUserId };
        if (month) {
          params.yearMonth = month;
        }
        // API는 동일, 백엔드가 토큰으로 필터링
        const res = await api.get('/system/commission/my/performance', {
          params,
        });
        setRows(res.data);
      } catch (e: any) {
        toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
      } finally {
        setLoading(false);
      }
    },
    [myUserId],
  );

  useEffect(() => {
    loadRows(selectedMonth);
  }, [selectedMonth, loadRows]);

  const onMonthChange = (e: any) => {
    const date = e.value as Date; // e.value가 null일 수도 있음
    setSelectedMonth(toLocalYearMonth(date));
  };

  // 컬럼 (읽기 전용)
  const performanceCols = useMemo(() => {
    const columns = getPerformanceDataColumns(false); // canEdit = false
    return columns.filter((col: any) => col.key != 'user.userNm');
  }, []);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
      <span className="p-card-title">내 실적 조회</span>
      <div className="flex align-items-center gap-2">
        <label htmlFor="monthpicker-my-perf" className="p-sr-only">
          월 선택
        </label>
        <Calendar
          id="monthpicker-my-perf"
          value={selectedMonth ? new Date(selectedMonth) : null}
          onChange={onMonthChange}
          view="month"
          dateFormat="yy-mm"
          placeholder="전체 기간"
          style={{ minWidth: '10rem' }}
        />
        <Button
          icon="pi pi-refresh"
          onClick={() => loadRows(selectedMonth)}
          className="p-button-sm"
          outlined
        />
      </div>
    </div>
  );

  return (
    <div className="page-flex-container">
      <Toast ref={toast} />
      <Card header={cardHeader} className="card-flex-full">
        {loading ? (
          <ProgressSpinner className="m-auto" />
        ) : (
          <ReusableDataTable<PerformanceData>
            value={rows}
            dataKey="id"
            useHeader={false} // Card 헤더 사용
            loading={loading}
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            // --- 읽기 전용 ---
            editMode={undefined}
            editingRows={undefined}
            onRowEditComplete={() => {}}
            onRowEditChange={() => {}}
          >
            {performanceCols}
          </ReusableDataTable>
        )}
      </Card>
    </div>
  );
}
