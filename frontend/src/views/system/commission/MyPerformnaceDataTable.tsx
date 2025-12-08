import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import type { Performance } from 'src/config/types/Commission';
import { getMyPerformanceColumns } from 'src/config/grid-defs/myPerformanceColDefs';
import api from 'src/api/axios';
import { toLocalYearMonth } from 'src/utils/dateUtils';
import PerformanceDetailModal from './PerformanceDetailModal';

export default function MyPerformanceDataTable() {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Performance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPerfId, setSelectedPerfId] = useState<number | null>(null);

  // 1. 데이터 로드 (백엔드가 토큰으로 필터링)
  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = selectedMonth ? { yearMonth: selectedMonth } : {};
      const res = await api.get('/system/commission/my/performance', { params });
      setRows(res.data);
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const onDetailClick = (data: Performance) => {
    setSelectedPerfId(data.id);
    setDetailVisible(true);
  };

  const columns = useMemo(() => getMyPerformanceColumns(), []);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
      <span className="p-card-title">내 실적 조회</span>
      <div className="flex align-items-center gap-2">
        <label className="p-sr-only">월 선택</label>

        <Calendar
          value={selectedMonth ? new Date(selectedMonth) : null}
          onChange={(e) => setSelectedMonth(e.value ? toLocalYearMonth(e.value) : null)}
          view="month"
          dateFormat="yy-mm"
          placeholder="전체 기간"
          style={{ minWidth: '10rem' }}
        />
        <Button icon="pi pi-refresh" onClick={loadRows} className="p-button-sm" outlined />
      </div>
    </div>
  );
  return (
    <>
      <Toast ref={toast} />
      <PerformanceDetailModal
        visible={detailVisible}
        onHide={() => setDetailVisible(false)}
        performanceId={selectedPerfId}
        isEditable={false} // 사용자는 항상 읽기 전용
        onSaveSuccess={loadRows}
      />

      <Card header={cardHeader} className="card-flex-full">
        {loading ? (
          <div className="text-center p-5">
            <ProgressSpinner />
          </div>
        ) : (
          <ReusableDataTable<Performance>
            value={rows}
            dataKey="id"
            useHeader={false} // Card 헤더 사용
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            // --- 읽기 전용 ---
            editMode={undefined}
            editingRows={undefined}
            selectionMode="single"
            onRowClick={(e) => onDetailClick(e.data as Performance)}
            rowHover
          >
            {columns}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
