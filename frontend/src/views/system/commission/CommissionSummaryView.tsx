import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Calendar } from 'primereact/calendar';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import type { CommissionSummary } from 'src/config/types/Commission';
import api from 'src/api/axios';
import { getDefaultPreviousMonth, toLocalYearMonth } from 'src/utils/dateUtils';
import CommissionDetailModal from './CommissionDetailModal';
import AdjustmentAmountModal from './AdjustmentAmountModal';
import { getCommissionSummaryColumns } from 'src/config/grid-defs/commissionSummaryColDefs';

interface CommissionSummaryViewProps {
  mode: 'MANAGE' | 'MY'; // 👈 동작 모드 결정
  commissionType: 'RECRUITMENT' | 'PROMOTION_BONUS';
  title: string;
}

export default function CommissionSummaryView({
  mode,
  commissionType,
  title,
}: CommissionSummaryViewProps) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<CommissionSummary[]>([]);
  const [selectedRow, setSelectedRow] = useState<CommissionSummary | null>(null);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  // 관리자 모드일 때만 초기값 설정 (사용자 모드는 전체 조회가 기본)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    mode === 'MANAGE' ? getDefaultPreviousMonth() : null,
  );

  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 1. 데이터 로드
  const loadSummary = useCallback(
    async (month: string | null) => {
      // MANAGE 모드에서는 월 선택 필수
      if (mode === 'MANAGE' && !month) {
        setSummaryRows([]);
        return;
      }

      setLoading(true);
      try {
        // 모드에 따른 API 엔드포인트 선택
        const baseUrl =
          mode === 'MANAGE' ? '/system/commission/manage/summary' : '/system/commission/my/summary';

        const params: any = {};
        if (month) {
          params.yearMonth = month;
        }
        params.commissionType = commissionType;

        const res = await api.get(baseUrl, { params });
        setSummaryRows(res.data);
      } catch (e: any) {
        toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
      } finally {
        setLoading(false);
      }
    },
    [mode, commissionType],
  );

  const handleAdjustClick = (rowData: CommissionSummary) => {
    setSelectedRow(rowData);
    setAdjustmentModalVisible(true);
  };

  useEffect(() => {
    loadSummary(selectedMonth);
  }, [selectedMonth, loadSummary]);

  const onMonthChange = (e: any) => {
    if (e.value) {
      setSelectedMonth(toLocalYearMonth(e.value as Date));
    } else {
      setSelectedMonth(null);
    }
  };

  const onRowClick = (e: any) => {
    setSelectedRow(e.data as CommissionSummary);
    console.log(e.data);
    console.log('선택된 데이터 : ', selectedRow);
    setDetailModalVisible(true);
  };

  const onHideModal = () => {
    setDetailModalVisible(false);
    setSelectedRow(null); // 선택 초기화
  };

  // 모드에 따른 UI 텍스트 설정
  const placeholder = mode === 'MANAGE' ? '월 선택 (필수)' : '전체 기간';

  const onAdjustmentSaved = () => {
    loadSummary(selectedMonth); // 테이블 새로고침
  };

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
      <span className="p-card-title">{title}</span>
      <div className="flex align-items-center gap-2">
        <label htmlFor={`monthpicker-${mode}`} className="p-sr-only">
          월 선택
        </label>
        <Calendar
          id={`monthpicker-${mode}`}
          value={selectedMonth ? new Date(selectedMonth) : null}
          onChange={onMonthChange}
          view="month"
          dateFormat="yy-mm"
          placeholder={placeholder}
          style={{ minWidth: '10rem' }}
        />
        <Button
          icon="pi pi-refresh"
          onClick={() => loadSummary(selectedMonth)}
          className="p-button-sm"
          outlined
        />
      </div>
    </div>
  );

  const summaryCols = useMemo(
    () => getCommissionSummaryColumns({ mode, onAdjust: handleAdjustClick }),
    [mode, handleAdjustClick], // onAdjust는 useCallback으로 감싸면 더 최적화됨
  );

  return (
    <>
      <Toast ref={toast} />
      <CommissionDetailModal
        visible={detailModalVisible}
        summaryData={selectedRow}
        onHide={onHideModal}
        mode={mode}
        commissionType={commissionType}
        title={title}
      />
      <AdjustmentAmountModal
        visible={adjustmentModalVisible}
        ledgerData={selectedRow}
        onHide={() => setAdjustmentModalVisible(false)}
        onSave={onAdjustmentSaved}
      />
      <Card header={cardHeader} className="card-flex-full">
        {loading ? (
          <ProgressSpinner className="m-auto" />
        ) : (
          <ReusableDataTable<CommissionSummary>
            value={summaryRows}
            // MANAGE 모드 키: userId, MY 모드 키: yearMonth
            dataKey="ledgerId"
            useHeader={mode === 'MANAGE'}
            useGlobalFilter={mode === 'MANAGE'} // 내 조회에선 필터 불필요
            usePagination
            defaultRows={10}
            filterDisplay={mode === 'MANAGE' ? 'row' : undefined}
            scrollHeight="flex"
            selectionMode="single"
            metaKeySelection={false}
            selection={selectedRow}
            onRowClick={onRowClick}
            onSelectionChange={(e) => setSelectedRow(e.value)}
            rowHover
          >
            {summaryCols}
          </ReusableDataTable>
        )}
      </Card>
    </>
  );
}
