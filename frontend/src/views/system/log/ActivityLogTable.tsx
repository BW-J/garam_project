import { useMemo, useRef, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getActivityLogColumns } from 'src/config/grid-defs/activityLogColDefs';
import type { ActivityLog } from 'src/config/types/Log';

export default function ActivityLogTable() {
  const toast = useRef<Toast | null>(null);

  const { rows, loading, globalFilter, setGlobalFilter, loadRows } = useDataTable<ActivityLog>({
    apiBaseUrl: '/system/logs/activity',
    idField: 'activityId',
    toast: toast,
    newRowDefaults: {}, // 읽기 전용
  });

  // 최초 로드
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const logCols = useMemo(() => getActivityLogColumns(), []);

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">행위 로그</span>
      <Button
        icon="pi pi-refresh"
        label="조회"
        onClick={loadRows}
        className="p-button-sm"
        outlined
      />
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
          <ReusableDataTable<ActivityLog>
            value={rows}
            dataKey="activityId"
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
