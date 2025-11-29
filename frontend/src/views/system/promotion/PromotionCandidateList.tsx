import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { Column } from 'primereact/column';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import api from 'src/api/axios';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Card } from 'primereact/card';
import type { DataTableDataSelectableEvent } from 'primereact/datatable';

interface CandidateListProps {
  targetPosition: 'MANAGER' | 'DIRECTOR'; // 본부장 대상인지, 지사장 대상인지
}

// 백엔드 응답 타입 (PromotionService.getPromotionCandidates 반환값)
interface PromotionCandidate {
  user: {
    userId: number;
    userNm: string;
    loginId: string;
    appointmentDate: string;
  };
  isEligible: boolean;
  unmetConditions: string[];
}

export default function PromotionCandidateList({ targetPosition }: CandidateListProps) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<PromotionCandidate[]>([]);

  // 1. 데이터 로드
  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/promotion/candidates', {
        params: { targetPosition },
      });
      setCandidates(res.data);
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '조회 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [targetPosition]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // 2. 승진 실행 핸들러
  const handlePromote = (user: PromotionCandidate['user']) => {
    confirmDialog({
      message: `[${user.userNm}] 님을 승진 처리하시겠습니까?`,
      header: '승진 확인',
      icon: 'pi pi-exclamation-triangle',
      // acceptClassName: 'p-button-success',
      acceptLabel: '승진',
      rejectLabel: '취소',
      accept: async () => {
        setLoading(true);
        try {
          await api.post(`/system/promotion/promote/${user.userId}`);
          toast.current?.show({
            severity: 'success',
            summary: '승진 완료',
            detail: `${user.userNm}님 처리 완료.`,
          });
          loadCandidates(); // 목록 새로고침
        } catch (e: any) {
          toast.current?.show({
            severity: 'error',
            summary: '승진 실패',
            detail: e.response?.data?.message || e.message,
          });
          setLoading(false);
        }
      },
    });
  };

  // 3. [신규] 일괄 승진 핸들러
  const handleBatchPromote = () => {
    if (selectedCandidates.length === 0) {
      toast.current?.show({
        severity: 'info',
        summary: '알림',
        detail: '승진시킬 대상을 선택하세요.',
      });
      return;
    }

    // [요청사항] 승진 대상이 아닌 사람이 끼어있으면 막기
    const eligibleSelection = selectedCandidates.filter((c) => c.isEligible);
    const ineligibleCount = selectedCandidates.length - eligibleSelection.length;

    if (ineligibleCount > 0) {
      toast.current?.show({
        severity: 'warn',
        summary: '선택 오류',
        detail: `자격 미충족 인원 ${ineligibleCount}명을 제외하고 진행합니다. (또는 막습니다 - 현재 로직은 미충족자 제외 후 진행)`,
      });
      return;
    }

    if (eligibleSelection.length === 0) {
      toast.current?.show({
        severity: 'info',
        summary: '알림',
        detail: '선택된 인원 중 승진 대상자가 없습니다.',
      });
      return;
    }

    const userNames = eligibleSelection.map((c) => c.user.userNm).join(', ');
    const userIds = eligibleSelection.map((c) => c.user.userId);

    confirmDialog({
      message: `총 ${eligibleSelection.length}명 (${userNames})을(를) 일괄 승진 처리하시겠습니까?`,
      header: '일괄 승진 확인',
      icon: 'pi pi-exclamation-triangle',
      // acceptClassName: 'p-button-success',
      acceptLabel: '일괄 승진',
      rejectLabel: '취소',
      accept: async () => {
        setLoading(true);
        try {
          // [신규] Batch API 호출
          const res = await api.post('/system/promotion/promote/batch', { userIds });
          toast.current?.show({
            severity: 'success',
            summary: '일괄 승진 완료',
            detail: `성공 ${res.data.successCount}건, 실패 ${res.data.failedCount}건`,
          });
          loadCandidates(); // 목록 새로고침
          setSelectedCandidates([]); // 선택 초기화
        } catch (e: any) {
          toast.current?.show({
            severity: 'error',
            summary: '일괄 승진 실패',
            detail: e.response?.data?.message || e.message,
          });
          setLoading(false);
        }
      },
    });
  };

  const cardHeader = useMemo(
    () => (
      <div className="flex justify-content-between align-items-center pt-3 px-3 flex-wrap gap-2">
        <span className="p-card-title">
          {targetPosition === 'MANAGER' ? '본부장 승진 대상자' : '지사장 승진 대상자'}
        </span>
        <div className="flex align-items-center gap-2">
          <Button icon="pi pi-refresh" onClick={loadCandidates} className="p-button-sm" outlined />
          <Button
            label="선택 일괄 승진"
            icon="pi pi-check-square"
            className="p-button-sm "
            onClick={handleBatchPromote}
            disabled={selectedCandidates.length === 0 || loading}
          />
        </div>
      </div>
    ),
    [loadCandidates, handleBatchPromote, selectedCandidates, loading, targetPosition],
  );

  const isRowSelectable = (event: DataTableDataSelectableEvent): boolean => {
    // event.data가 Record<string, any> 타입이므로 캐스팅 필요
    const candidate = event.data as PromotionCandidate;
    return candidate.isEligible;
  };

  // --- 컬럼 템플릿 ---
  const eligibilityBody = (rowData: PromotionCandidate) => {
    return rowData.isEligible ? (
      <Tag severity="success" value="충족" />
    ) : (
      <Tag severity="warning" value="미충족" />
    );
  };

  const unmetBody = (rowData: PromotionCandidate) => {
    //if (rowData.isEligible) return 'N/A';
    return (
      <ul className="list-none p-0 m-0">
        {rowData.unmetConditions.map((reason, idx) => (
          <li key={idx} className="text-sm">
            {reason}
          </li>
        ))}
      </ul>
    );
  };

  const actionBody = (rowData: PromotionCandidate) => (
    <Button
      label="승진"
      icon="pi pi-check"
      className="p-button-sm "
      disabled={!rowData.isEligible}
      onClick={() => handlePromote(rowData.user)}
    />
  );

  return (
    <Card header={cardHeader} className="card-flex-full">
      <Toast ref={toast} />
      <ConfirmDialog />
      <ReusableDataTable<PromotionCandidate>
        value={candidates}
        dataKey="user.userId"
        loading={loading}
        useHeader
        filterDisplay="row"
        useGlobalFilter
        sortField="isEligible"
        sortOrder={-1}
        onReload={loadCandidates}
        usePagination
        defaultRows={10}
        scrollHeight="flex"
        selectionMode="multiple"
        selection={selectedCandidates}
        onSelectionChange={(e) => setSelectedCandidates(e.value as PromotionCandidate[])}
        isDataSelectable={isRowSelectable}
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        <Column
          field="user.userNm"
          header="성명"
          sortable
          filter
          showFilterMenu={false}
          showClearButton={false}
          filterMatchMode="contains"
        />
        <Column
          field="user.loginId"
          header="ID"
          sortable
          filter
          showFilterMenu={false}
          showClearButton={false}
          filterMatchMode="contains"
        />
        <Column
          field="user.appointmentDate"
          header="위촉일"
          body={(r) => new Date(r.user.appointmentDate).toLocaleDateString()}
          sortable
        />
        <Column
          header="자격"
          body={eligibilityBody}
          style={{ width: '6rem', textAlign: 'center' }}
        />
        <Column header="조건" body={unmetBody} style={{ minWidth: '15rem' }} />
        <Column header="관리" body={actionBody} style={{ width: '8rem', textAlign: 'center' }} />
      </ReusableDataTable>
    </Card>
  );
}
