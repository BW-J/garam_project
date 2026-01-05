import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Button } from 'primereact/button';

import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import api from 'src/api/axios';
import type { Performance, PerformanceDetail } from 'src/config/types/Commission';
import { getPerformanceDetailColumns } from 'src/config/grid-defs/performanceDetailColDefs';
import type { DataTableRowEditCompleteEvent } from 'primereact/datatable';

interface Props {
  visible: boolean;
  onHide: () => void;
  performanceId: number | null;
  isEditable: boolean;
  onSaveSuccess: () => void;
}

export default function PerformanceDetailModal({
  visible,
  onHide,
  performanceId,
  isEditable,
  onSaveSuccess,
}: Props) {
  const toast = useRef<Toast | null>(null);
  const [perfData, setPerfData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!performanceId) return;
    setLoading(true);
    try {
      const res = await api.get('/system/commission/manage/performance', {
        params: { id: performanceId },
      });
      if (res.data && res.data.length > 0) setPerfData(res.data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [performanceId]);

  useEffect(() => {
    if (visible && performanceId) loadData();
    else {
      setPerfData(null);
    }
  }, [visible, performanceId]);

  const onRowEditComplete = async (e: DataTableRowEditCompleteEvent) => {
    const { newData } = e;
    const detail = newData as PerformanceDetail;

    // 조정 데이터는 수정 불가 (삭제 후 재등록 유도) - 원복
    if (detail.category === 'ADJUSTMENT') {
      toast.current?.show({
        severity: 'warn',
        summary: '수정 불가',
        detail: '조정 내역은 삭제 후 다시 등록해주세요.',
      });
      return; // UI상 원복은 안되지만 API 호출 안함
    }

    try {
      await api.patch(`/system/commission/detail/${detail.detailId}`, {
        insurancePremium: detail.insurancePremium,
        withdrawal: detail.withdrawal,
        cancellation: detail.cancellation,
        lapse: detail.lapse,
        note: detail.note,
      });
      toast.current?.show({ severity: 'success', summary: '저장됨' });
      await loadData(); // 재조회 (합계 갱신)
      onSaveSuccess(); // 부모 갱신 (재계산 알림용)
    } catch (e: any) {
      toast.current?.show({
        severity: 'error',
        summary: '오류',
        detail: e.response?.data?.message,
      });
    }
  };

  const handleDelete = (detailId: number) => {
    confirmDialog({
      message: '삭제하시겠습니까?',
      header: '삭제 확인',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await api.delete(`/system/commission/detail/${detailId}`);
          toast.current?.show({ severity: 'success', summary: '삭제 완료' });
          await loadData();
          onSaveSuccess();
        } catch (e: any) {
          toast.current?.show({
            severity: 'error',
            summary: '오류',
            detail: e.response?.data?.message,
          });
        }
      },
    });
  };

  const columns = useMemo(
    () =>
      getPerformanceDetailColumns({
        isEditable,
        onDelete: handleDelete,
      }),
    [isEditable, handleDelete],
  );

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        header={`실적 상세 (${perfData?.user?.userNm || ''})`}
        visible={visible}
        onHide={onHide}
        style={{ width: '1200px' }}
        breakpoints={{ '1440px': '80vw', '960px': '95vw', '641px': '95vw' }}
        modal
        maximizable
        dismissableMask
      >
        <div style={{ minHeight: '300px' }}>
          <ReusableDataTable
            value={perfData?.details || []}
            dataKey="detailId"
            loading={loading}
            usePagination={false}
            useHeader={false}
            useGlobalFilter={false}
            stripedRows
            size="small"
            editMode="row"
            onRowEditComplete={onRowEditComplete}
          >
            {columns}
          </ReusableDataTable>
        </div>

        <div className="flex justify-content-end align-items-center mt-3 pt-3 border-top-1 surface-border gap-4">
          <div className="text-xl font-bold">
            합계: {Number(perfData?.settlementAmount).toLocaleString()} 원
          </div>
          <div className="text-xl font-bold text-primary">
            절삭: {Number(perfData?.truncatedAmount).toLocaleString()} 원
          </div>
        </div>

        <div className="flex justify-content-end mt-3">
          <Button label="닫기" onClick={onHide} />
        </div>
      </Dialog>
    </>
  );
}
