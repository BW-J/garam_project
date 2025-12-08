import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { useRef } from 'react';

import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
// 관리자용 컬럼 정의를 재사용 (사용자 정보 표시용)
import { getManagerPerformanceColumns } from 'src/config/grid-defs/managerPerformanceColDefs';
import api from 'src/api/axios';
import { toLocalYearMonth } from 'src/utils/dateUtils';
import type { Performance } from 'src/config/types/Commission';
import PerformanceDetailModal from './PerformanceDetailModal';

export default function DownlinePerformanceDataTable() {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Performance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // 상세 모달
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPerfId, setSelectedPerfId] = useState<number | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = selectedMonth ? { yearMonth: selectedMonth } : {};
      const res = await api.get('/system/commission/my/downline-performance', { params });
      setRows(res.data);
    } catch (e: any) {
      console.error(e);
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

  // [핵심] isEditable=false로 전달하여 수정 버튼 등을 숨김
  const columns = useMemo(
    () =>
      getManagerPerformanceColumns({
        canEdit: false,
        onEditIqa: () => {},
        onAddAdjustment: () => {},
      }),
    [],
  );

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
      <span className="p-card-title">하위 조직원 실적 조회</span>
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
        isEditable={false} // 하위 실적도 읽기 전용
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
            useHeader={false}
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            useGlobalFilter
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
