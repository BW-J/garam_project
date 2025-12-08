import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { FileUpload, type FileUploadHandlerEvent } from 'primereact/fileupload';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import type { Performance } from 'src/config/types/Commission';
import { getManagerPerformanceColumns } from 'src/config/grid-defs/managerPerformanceColDefs';
import api from 'src/api/axios';
import { Message } from 'primereact/message';
import { getDefaultPreviousMonth, isEditablePeriod, toLocalYearMonth } from 'src/utils/dateUtils';
import PerformanceDetailModal from './PerformanceDetailModal';
import AdjustmentAmountModal from './AdjustmentAmountModal';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';

export default function ManagerPerformanceDataTable() {
  const toast = useRef<Toast | null>(null);
  const fileUploadRef = useRef<FileUpload | null>(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Performance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(getDefaultPreviousMonth());

  // 1. 상세 모달용 ID
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);

  // 2. IQA 수정용 정보
  const [iqaVisible, setIqaVisible] = useState(false);
  const [iqaTarget, setIqaTarget] = useState<{ id: number; rate: number } | null>(null);
  const [newIqa, setNewIqa] = useState<number | null>(null);

  // 3. 조정 추가용 정보
  const [adjVisible, setAdjVisible] = useState(false);
  const [adjTarget, setAdjTarget] = useState<{ id: number; name: string } | null>(null);

  const [needsRecalc, setNeedsRecalc] = useState(false);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

  // 1. 데이터 로드 (useDataTable 대신 수동 구현)
  const loadRows = useCallback(async () => {
    if (!selectedMonth) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/system/commission/manage/performance', {
        params: { yearMonth: selectedMonth },
      });
      setRows(res.data);

      if (permissionSet.canEdit || permissionSet.canCreate) {
        // 혹은 isSuperAdmin 체크
        const statusRes = await api.get('/system/commission/status', {
          params: { yearMonth: selectedMonth },
        });
        setNeedsRecalc(statusRes.data.needsRecalculation);
      }
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // 2. 최초 로드 및 월 변경 시 자동 로드
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const isEditable = useMemo(() => isEditablePeriod(selectedMonth), [selectedMonth]);

  // 4. (관리자) Excel 업로드 핸들러
  const handleUpload = async (e: FileUploadHandlerEvent) => {
    if (!selectedMonth) return;
    const file = e.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('yearMonth', selectedMonth);

    setLoading(true);
    try {
      const res = await api.post('/system/commission/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.current?.show({
        severity: 'success',
        summary: '업로드 성공',
        detail: `${res.data.count}개 행이 처리되었습니다.`,
      });
      await loadRows(); // 업로드 후 테이블 새로고침
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '업로드 실패', detail: e.message });
    } finally {
      fileUploadRef.current?.clear();
      setLoading(false);
    }
  };

  // 5. (관리자) 수당 계산 실행 핸들러
  const handleCalculate = async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      await api.post('/system/commission/calculate', {
        yearMonth: selectedMonth,
      });
      toast.current?.show({
        severity: 'success',
        summary: '계산 완료',
        detail: `계산이 완료되었습니다.`,
      });
      loadRows();
    } catch (e: any) {
      toast.current?.show({
        severity: 'error',
        summary: '실패',
        detail: e.response?.data?.message || e.message || ' ',
      });
    } finally {
      setLoading(false);
    }
  };

  const onDetailClick = (data: Performance) => {
    setSelectedDetailId(data.id);
    setDetailVisible(true);
  };

  const onEditIqa = (data: Performance) => {
    setIqaTarget({ id: data.id, rate: data.iqaMaintenanceRate });
    setNewIqa(data.iqaMaintenanceRate);
    setIqaVisible(true);
  };

  const saveIqa = async () => {
    if (!iqaTarget || newIqa === null) return;
    try {
      await api.patch(`/system/commission/performance/${iqaTarget.id}/iqa`, {
        iqaMaintenanceRate: newIqa,
      });
      toast.current?.show({ severity: 'success', summary: '저장 완료' });
      setIqaVisible(false);
      loadRows();
    } catch (e: any) {
      toast.current?.show({
        severity: 'error',
        summary: '오류',
        detail: e.response?.data?.message,
      });
    }
  };

  const onAddAdjustment = (data: Performance) => {
    setAdjTarget({ id: data.id, name: data.user?.userNm || '' });
    setAdjVisible(true);
  };

  const canEdit = permissionSet.canEdit && isEditable;
  const canCreate = permissionSet.canCreate && isEditable;
  const columns = useMemo(
    () =>
      getManagerPerformanceColumns({
        canEdit,
        onEditIqa,
        onAddAdjustment,
      }),
    [canEdit],
  );

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
      <span className="p-card-title">실적 데이터 관리</span>
      <div className="flex align-items-center gap-2">
        <Calendar
          value={selectedMonth ? new Date(selectedMonth) : null}
          onChange={(e) => {
            // e.value는 Date | Date[] | null 등이 될 수 있음.
            // 단일 선택이므로 Date | null로 단언하거나 유틸 사용
            if (e.value && !Array.isArray(e.value)) {
              setSelectedMonth(toLocalYearMonth(e.value));
            } else {
              setSelectedMonth(null);
            }
          }}
          view="month"
          dateFormat="yy-mm"
          placeholder="월 선택"
        />
        <Button
          icon="pi pi-refresh"
          onClick={loadRows}
          className="p-button-outlined p-button-secondary"
        />
        {canCreate && (
          <FileUpload
            ref={fileUploadRef}
            mode="basic"
            accept=".xlsx"
            auto
            customUpload
            uploadHandler={handleUpload}
            chooseLabel="업로드"
            className="p-button-sm"
            disabled={!selectedMonth}
          />
        )}
        {canCreate && (
          <Button
            label="계산 실행"
            icon="pi pi-calculator"
            onClick={handleCalculate}
            className="p-button-success p-button-sm"
            disabled={!selectedMonth}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />

      {/* 상세 모달 */}
      <PerformanceDetailModal
        visible={detailVisible}
        onHide={() => setDetailVisible(false)}
        performanceId={selectedDetailId}
        isEditable={canEdit} // 관리자 & 기간체크 통과 시 수정 가능
        onSaveSuccess={loadRows}
      />

      {/* IQA 수정 모달 */}
      <Dialog
        header="IQA 유지율 수정"
        visible={iqaVisible}
        onHide={() => setIqaVisible(false)}
        style={{ width: '300px' }}
      >
        <div className="field">
          <label>IQA (%)</label>
          <InputNumber
            value={newIqa}
            onValueChange={(e) => setNewIqa(e.value ?? null)}
            min={0}
            max={100}
            suffix="%"
            className="w-full"
          />
        </div>
        <div className="flex justify-content-end mt-3">
          <Button label="저장" onClick={saveIqa} />
        </div>
      </Dialog>

      {/* 조정 추가 모달 */}
      <AdjustmentAmountModal
        visible={adjVisible}
        onHide={() => setAdjVisible(false)}
        targetType="PERFORMANCE"
        targetId={adjTarget?.id || null}
        targetName={adjTarget?.name}
        onSave={loadRows}
      />
      <Card header={cardHeader} className="card-flex-full">
        {!isEditable && (permissionSet.canEdit || permissionSet.canCreate) && (
          <Message
            severity="info"
            text="데이터 수정 및 조정은 '지난 달' 데이터에 한해 가능합니다."
            className="w-full mb-2"
          />
        )}
        {needsRecalc && (
          <Message
            severity="warn"
            text="실적 데이터가 변경되었습니다. 정확한 지급을 위해 [수당 계산 실행]을 진행해주세요."
            className="w-full"
          />
        )}
        {loading ? (
          <div className="text-center p-5">
            <ProgressSpinner />
          </div>
        ) : (
          <ReusableDataTable<Performance>
            value={rows}
            dataKey="id"
            useHeader={false}
            useGlobalFilter
            usePagination
            defaultRows={10}
            scrollHeight="flex"
            filterDisplay="row"
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
