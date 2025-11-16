import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { FileUpload, type FileUploadHandlerEvent } from 'primereact/fileupload';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import type { PerformanceData } from 'src/config/types/Commission';
import { getPerformanceDataColumns } from 'src/config/grid-defs/performanceDataColDefs';
import api from 'src/api/axios';
import type { DataTableRowEditCompleteEvent } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { getDefaultPreviousMonth } from 'src/utils/dateUtils';

const isPreviousMonth = (yearMonth: string) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1~12

  // 지난달 계산
  let prevYear = currentYear;
  let prevMonth = currentMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  // 문자열 비교 ('YYYY-MM')
  const target = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  return yearMonth === target;
};

export default function PerformanceDataTable() {
  const toast = useRef<Toast | null>(null);
  const fileUploadRef = useRef<FileUpload | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PerformanceData[]>([]);
  const [editingRows, setEditingRows] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getDefaultPreviousMonth());
  const [needsRecalc, setNeedsRecalc] = useState(false);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

  // 1. 데이터 로드 (useDataTable 대신 수동 구현)
  const loadRows = useCallback(
    async (month: string) => {
      setLoading(true);
      try {
        const res = await api.get('/system/commission/manage/performance', {
          params: { yearMonth: month },
        });
        setRows(res.data);

        // 2. 해당 월 상태 로드 (관리자만)
        if (permissionSet.canEdit) {
          // 혹은 isSuperAdmin 체크
          const statusRes = await api.get('/system/commission/status', {
            params: { yearMonth: month },
          });
          setNeedsRecalc(statusRes.data.needsRecalculation);
        }
      } catch (e: any) {
        toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
      } finally {
        setLoading(false);
      }
    },
    [permissionSet.canEdit],
  );

  // 2. 최초 로드 및 월 변경 시 자동 로드
  useEffect(() => {
    if (selectedMonth) {
      loadRows(selectedMonth);
    }
  }, [selectedMonth, loadRows]);

  // 3. 월 선택 핸들러
  const onMonthChange = (e: any) => {
    if (e.value) {
      const date = e.value as Date;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${year}-${month}`);
    }
  };

  // 4. (관리자) Excel 업로드 핸들러
  const handleUpload = async (e: FileUploadHandlerEvent) => {
    const file = e.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('yearMonth', selectedMonth);

    try {
      setLoading(true);
      const res = await api.post('/system/commission/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.current?.show({
        severity: 'success',
        summary: '업로드 성공',
        detail: `${res.data.count}개 행이 처리되었습니다.`,
      });
      fileUploadRef.current?.clear();
      await loadRows(selectedMonth); // 업로드 후 테이블 새로고침
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '업로드 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  };

  // 5. (관리자) 수당 계산 실행 핸들러
  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/system/commission/calculate', {
        yearMonth: selectedMonth,
      });
      toast.current?.show({
        severity: 'success',
        summary: '계산 완료',
        detail: `${res.data.count}개의 수당 항목이 생성되었습니다.`,
      });

      await loadRows(selectedMonth);
      // (계산 후에는 원장(Ledger) 탭으로 이동 유도)
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '계산 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  };

  // 6. (관리자) 인라인 수정 완료 핸들러
  const onRowEditComplete = async (e: DataTableRowEditCompleteEvent) => {
    const { newData } = e;
    try {
      // (요청 반영) 수정 시 정산/절삭금액은 백엔드가 재계산
      await api.patch(`/system/commission/performance/${newData.id}`, {
        insurancePremium: newData.insurancePremium,
        withdrawal: newData.withdrawal,
        cancellation: newData.cancellation,
        lapse: newData.lapse,
        iqaMaintenanceRate: newData.iqaMaintenanceRate,
      });

      // 성공 메시지를 '경고(Warn)' 수준으로 변경하여 재계산 유도
      toast.current?.show({
        severity: 'warn', // ✨ info/success 대신 warn으로 강조
        summary: '수정 완료 (재계산 필요)',
        detail: '데이터가 변경되었습니다. 수당 계산을 다시 실행해주세요.',
        life: 5000, // 조금 더 오래 표시
      });

      await loadRows(selectedMonth); // 수정 후 새로고침 (재계산된 금액 반영)
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '수정 실패', detail: e.message });
      await loadRows(selectedMonth); // 실패 시 원복
    }
  };

  //  현재 선택된 월이 '지난달'인지 여부
  const isTargetMonth = useMemo(() => isPreviousMonth(selectedMonth), [selectedMonth]);

  //  편집 가능 여부 (권한 있음 AND 지난달임) 임시로 전부 열어둠
  // const canEdit = permissionSet.canEdit && isTargetMonth;
  const canEdit = permissionSet.canEdit;

  const performanceCols = useMemo(() => {
    return getPerformanceDataColumns(canEdit);
  }, [canEdit]);

  // 카드 헤더 (컨트롤러)
  const cardHeader = (
    <div className="flex flex-column gap-3 p-3">
      {/* 재계산 필요 영구 알림 메시지 */}
      {needsRecalc && canEdit && (
        <Message
          severity="warn"
          text="실적 데이터가 변경되었습니다. 정확한 지급을 위해 [수당 계산 실행]을 진행해주세요."
          className="w-full"
        />
      )}
      <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
        <span className="p-card-title">실적 데이터 관리</span>
        <div className="flex align-items-center gap-2 flex-wrap">
          <label htmlFor="monthpicker" className="p-sr-only">
            월 선택
          </label>
          <Calendar
            id="monthpicker"
            value={new Date(selectedMonth)}
            onChange={onMonthChange}
            view="month"
            dateFormat="yy-mm"
            style={{ minWidth: '10rem' }}
          />
          <Button
            icon="pi pi-refresh"
            onClick={() => loadRows(selectedMonth)}
            className="p-button-sm"
            outlined
          />
          {/* {permissionSet.canCreate && isTargetMonth && ( */}
          <FileUpload
            ref={fileUploadRef}
            mode="basic"
            name="file"
            accept=".xlsx, .xls"
            maxFileSize={10000000} // 10MB
            auto // 선택 즉시 업로드
            chooseLabel="Excel 업로드"
            customUpload
            uploadHandler={handleUpload}
            className="p-button-xs white-space-nowrap"
          />
          {/* )} */}
          {/* {permissionSet.canCreate && isTargetMonth && ( */}
          <Button
            label="수당 계산 실행"
            icon="pi pi-calculator"
            className="p-button-sm p-button-success white-space-nowrap"
            onClick={handleCalculate}
            loading={loading}
            // disabled={!isTargetMonth || loading}
          />
          {/* )} */}
        </div>
      </div>
    </div>
  );

  return (
    <Card header={cardHeader} className="card-flex-full">
      {loading ? (
        <ProgressSpinner className="m-auto" />
      ) : (
        <ReusableDataTable<PerformanceData>
          value={rows}
          dataKey="id"
          useHeader
          useGlobalFilter
          globalFilterValue={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          loading={loading}
          usePagination
          defaultRows={10}
          scrollHeight="flex"
          filterDisplay="row"
          // --- 인라인 편집 ---
          editMode={canEdit ? 'row' : undefined}
          editingRows={editingRows}
          onRowEditChange={(e) => setEditingRows(e.data)}
          onRowEditComplete={onRowEditComplete}
        >
          {performanceCols}
        </ReusableDataTable>
      )}
    </Card>
  );
}
