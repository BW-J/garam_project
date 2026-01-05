import { useMemo, useRef, useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getAuditLogColumns } from 'src/config/grid-defs/auditLogColDefs';
import type { AuditLog } from 'src/config/types/Log';
import { Calendar } from 'primereact/calendar';

export default function AuditLogTable() {
  const toast = useRef<Toast | null>(null);

  const [startDate, setStartDate] = useState<Date | null>(
    new Date(new Date().setDate(new Date().getDate() - 7)),
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  const { rows, loading, globalFilter, setGlobalFilter, loadRows } = useDataTable<AuditLog>({
    apiBaseUrl: '/system/logs/audit',
    idField: 'auditId',
    toast: toast,
    newRowDefaults: {}, // 읽기 전용
  });

  const handleSearch = () => {
    const params: any = {};

    const toDateString = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    if (startDate) params.startDate = toDateString(startDate);
    if (endDate) params.endDate = toDateString(endDate);

    loadRows(params);
  };

  // 최초 로드
  useEffect(() => {
    loadRows();
  }, []);

  const logCols = useMemo(() => getAuditLogColumns(), []);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center flex-wrap pt-3 px-3">
      <span className="p-card-title">감사 로그</span>
      <div className="flex flex-wrap gap-2 align-items-center">
        <div className="flex align-items-center gap-2">
          <Calendar
            value={startDate}
            onChange={(e) => setStartDate(e.value as Date)}
            showIcon
            dateFormat="yy-mm-dd"
            placeholder="시작일"
          />
          <span>~</span>
          <Calendar
            value={endDate}
            onChange={(e) => setEndDate(e.value as Date)}
            showIcon
            dateFormat="yy-mm-dd"
            placeholder="종료일"
          />
        </div>
        <Button
          icon="pi pi-refresh"
          label="조회"
          onClick={handleSearch}
          className="p-button-sm"
          outlined
        />
      </div>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />
      <Card header={cardHeader} className="card-flex-full">
        {loading ? (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        ) : (
          <ReusableDataTable<AuditLog>
            value={rows}
            dataKey="auditId"
            useHeader
            useGlobalFilter
            globalFilterValue={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            onReload={loadRows}
            loading={loading}
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            // --- 읽기 전용 ---
            editMode={undefined}
            editingRows={undefined}
            onRowEditComplete={() => {}}
            onRowEditChange={() => {}}
            filterDisplay="row"
          >
            {logCols}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
