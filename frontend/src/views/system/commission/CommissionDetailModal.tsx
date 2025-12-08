import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getCommissionLedgerHistoryColumns } from 'src/config/grid-defs/commissionLedgerHistoryColDefs';
import type { CommissionLedgerHistory, CommissionSummary } from 'src/config/types/Commission';
import api from 'src/api/axios';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Column } from 'primereact/column';
import { Toast } from 'primereact/toast';

interface CommissionDetailModalProps {
  visible: boolean;
  onHide: () => void;
  summaryData: CommissionSummary | null;
  mode: 'MANAGE' | 'MY';
  commissionType: string;
  title: string;
  isEditable: boolean;
  onSaveSuccess?: () => void;
}

export default function CommissionDetailModal({
  visible,
  onHide,
  summaryData,
  mode,
  commissionType,
  title,
  isEditable,
  onSaveSuccess,
}: CommissionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CommissionLedgerHistory[]>([]);
  const toast = useRef<Toast | null>(null);

  useEffect(() => {
    if (visible && summaryData) {
      loadDetails();
    } else {
      setRows([]);
    }
  }, [visible, summaryData]); // mode는 컴포넌트 라이프사이클 동안 안 바뀌므로 의존성에서 제외해도 무방

  const loadDetails = async () => {
    if (!summaryData) return;
    setLoading(true);
    try {
      const baseUrl =
        mode === 'MANAGE' ? '/system/commission/manage/history' : '/system/commission/my/history';

      const params = {
        yearMonth: summaryData.yearMonth,
        userId: summaryData.userId,
        commissionType: commissionType,
      };

      const res = await api.get(baseUrl, { params });
      setRows(res.data);
    } catch (err) {
      console.error('상세 내역 조회 실패', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdjustment = (historyId: number) => {
    confirmDialog({
      message: '이 조정 내역을 삭제하시겠습니까? (금액이 원복됩니다)',
      header: '삭제 확인',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await api.delete(`/system/commission/manage/adjust/${historyId}`);
          toast.current?.show({ severity: 'success', summary: '삭제 완료' });
          loadDetails(); // 목록 새로고침
          if (onSaveSuccess) onSaveSuccess();
        } catch (e: any) {
          console.error(e);
          // 에러 처리
        }
      },
    });
  };

  const columns = useMemo(() => {
    const baseCols = getCommissionLedgerHistoryColumns();
    // 2. 수정 가능한 기간인지 확인
    if (mode === 'MANAGE' && isEditable) {
      baseCols.push(
        <Column
          key="delete"
          header="삭제"
          alignHeader="center"
          style={{ width: '4rem', textAlign: 'center' }}
          body={(rowData: CommissionLedgerHistory) => {
            // 1. 조정 데이터인지 확인 (details json 내 adjustment 필드)
            // (백엔드 엔티티 타입에 details가 Record<string, any>로 정의되어 있다고 가정)
            const isAdjustment = rowData.details && (rowData.details as any).adjustment === true;

            // 두 조건 모두 만족 시에만 삭제 버튼 표시
            if (isAdjustment && isEditable) {
              return (
                <Button
                  icon="pi pi-trash"
                  className="p-button-rounded p-button-danger p-button-text"
                  onClick={() => handleDeleteAdjustment(rowData.historyId)}
                  tooltip="조정 삭제"
                />
              );
            }
            return null; // 조건 불만족 시 빈 칸
          }}
        />,
      );
    }
    return baseCols;
  }, [mode, isEditable, handleDeleteAdjustment]); // 의존성 배열

  const headerTitle = summaryData
    ? `${summaryData.userNm} (${summaryData.yearMonth}) ${title}`
    : ` ${title}`;

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={headerTitle}
      modal
      className="responsive-dialog"
      style={{ width: '1200px' }}
      dismissableMask
      maximizable
      contentStyle={{ minHeight: '400px' }}
    >
      <Toast ref={toast} />
      <ConfirmDialog />
      {loading ? (
        <div
          className="flex align-items-center justify-content-center h-full"
          style={{ minHeight: '300px' }}
        >
          <ProgressSpinner />
        </div>
      ) : (
        <ReusableDataTable
          value={rows}
          dataKey="historyId"
          usePagination
          defaultRows={10}
          loading={loading}
          useHeader={false}
          scrollHeight="flex"
        >
          {columns}
        </ReusableDataTable>
      )}
      <div className="flex justify-content-end mt-3">
        <Button label="닫기" icon="pi pi-times" onClick={onHide} />
      </div>
    </Dialog>
  );
}
