import { useState, useEffect, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getCommissionLedgerHistoryColumns } from 'src/config/grid-defs/commissionLedgerHistoryColDefs';
import type { CommissionLedgerHistory, CommissionSummary } from 'src/config/types/Commission';
import api from 'src/api/axios';

interface CommissionDetailModalProps {
  visible: boolean;
  onHide: () => void;
  summaryData: CommissionSummary | null;
  mode: 'MANAGE' | 'MY'; // 👈 [신규] 모드 전달받음
  commissionType: string;
  title: string;
}

export default function CommissionDetailModal({
  visible,
  onHide,
  summaryData,
  mode, // 👈 destructuring
  commissionType,
  title,
}: CommissionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CommissionLedgerHistory[]>([]);

  useEffect(() => {
    console.log(`visible = ${visible}`);
    console.log(`summaryData = ${summaryData}`);
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
      // 👇 [수정] 전달받은 mode를 기준으로 엔드포인트 결정
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

  const columns = useMemo(() => getCommissionLedgerHistoryColumns(), []);

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
