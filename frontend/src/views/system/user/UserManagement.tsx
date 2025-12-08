import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useAuthStore } from 'src/store/authStore';
import { getCurrentMenuPermission } from 'src/utils/permissionUtils';
import { useDataTable } from 'src/hooks/useDataTable';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import { getUserColumns } from 'src/config/grid-defs/userColDefs';
import UserFormModal from 'src/views/system/user/UserFormModal';
import type { User } from 'src/config/types/User';
import api from 'src/api/axios';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { ContextMenu } from 'primereact/contextmenu';
import { Dialog } from 'primereact/dialog';
import GenealogyChart from 'src/views/dashboard/GenealogyChart';

export default function UserManagement() {
  const toast = useRef<Toast | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    isActive: { value: true, matchMode: 'equals' },

    userId: { value: null, matchMode: 'contains' },
    loginId: { value: null, matchMode: 'contains' },
    userNm: { value: null, matchMode: 'contains' },
    cellPhone: { value: null, matchMode: 'contains' },
    'department.deptNm': { value: null, matchMode: 'contains' },
    'position.positionNm': { value: null, matchMode: 'contains' },
    'recommender.userNm': { value: null, matchMode: 'contains' },
  });
  const cm = useRef<ContextMenu | null>(null);
  const [contextSelectedUser, setContextSelectedUser] = useState<User | null>(null);
  const [isGenealogyVisible, setIsGenealogyVisible] = useState(false);

  const authorizedMenu = useAuthStore((state) => state.authorizedMenu);
  const permissionSet = useMemo(() => {
    return getCurrentMenuPermission(authorizedMenu);
  }, [authorizedMenu]);

  const contextMenuItems = [
    {
      label: '계보도 보기',
      icon: 'pi pi-sitemap',
      command: () => setIsGenealogyVisible(true),
    },
    // 필요 시 '비밀번호 초기화' 등 추가 가능
  ];
  //useDataTable의 deleteRow는 사용하지 않음
  const {
    rows,
    loading,
    globalFilter,
    setGlobalFilter,
    loadRows,
    deleteRow: _unusedDeleteRow, // 훅의 deleteRow(토글)는 사용하지 않음
  } = useDataTable<User>({
    apiBaseUrl: '/system/users', // 사용자 API
    idField: 'userId',
    toast: toast,
    newRowDefaults: {}, // 모달을 사용하므로 이 옵션은 필요하지 않음
  });

  // 최초 로드
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // --- 핸들러 ---
  const handleAddNew = () => {
    setSelectedUserId(null); // 폼 비우기 (신규)
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUserId(user.userId); // 폼 채우기 (수정)
    setIsModalVisible(true);
  };

  // Soft Delete 핸들러
  const handleDelete = useCallback(
    async (user: User) => {
      try {
        await api.delete(`/system/users/${user.userId}`);
        toast.current?.show({
          severity: 'success',
          summary: '삭제 완료',
          detail: `[${user.userNm}] 사용자가 삭제 처리되었습니다.`,
        });
        loadRows(); // 목록 새로고침
      } catch (error: any) {
        console.error('삭제 처리 실패', error);
        toast.current?.show({
          severity: 'error',
          summary: '오류',
          detail: error.response?.data?.message || '삭제 처리에 실패했습니다.',
        });
      }
    },
    [loadRows, toast],
  );

  // Restore 핸들러
  const handleRestore = useCallback(
    async (user: User) => {
      try {
        await api.patch(`/system/users/restore/${user.userId}`);
        toast.current?.show({
          severity: 'success',
          summary: '복구 완료',
          detail: `[${user.userNm}] 사용자가 복구 처리되었습니다.`,
        });
        loadRows(); // 목록 새로고침
      } catch (error: any) {
        console.error('복구 처리 실패', error);
        toast.current?.show({
          severity: 'error',
          summary: '오류',
          detail: error.response?.data?.message || '복구 처리에 실패했습니다.',
        });
      }
    },
    [loadRows, toast],
  );

  // 모달에서 저장이 완료되었을 때
  const handleSave = () => {
    setIsModalVisible(false); // 모달 닫기
    loadRows(); // 테이블 새로고침
  };

  // --- 컬럼 및 헤더 정의 ---
  const userCols = useMemo(
    () =>
      getUserColumns({
        onEdit: handleEdit,
        onDelete: handleDelete,
        onRestore: handleRestore,
        permissions: permissionSet,
      }),
    [permissionSet, handleDelete, handleRestore],
  );

  const cardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">사용자 관리</span>
      <div className="flex gap-2">
        <Button
          icon="pi pi-refresh"
          label="조회"
          onClick={loadRows}
          className="p-button-sm"
          outlined
        />
        {permissionSet.canCreate && (
          <Button
            icon="pi pi-plus"
            label="사용자 추가"
            onClick={handleAddNew}
            className="p-button-sm"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />
      <ContextMenu model={contextMenuItems} ref={cm} />
      <Dialog
        visible={isGenealogyVisible}
        onHide={() => {
          setIsGenealogyVisible(false);
          setContextSelectedUser(null); // 모달 닫을 때 초기화하고 싶다면 주석 해제 (안 해도 무방)
        }}
        style={{ width: '80vw', height: '90vh' }}
        header={`[${contextSelectedUser?.userNm}] 님 계보도`}
        maximizable
        modal
        dismissableMask
      >
        {contextSelectedUser && (
          // 방금 수정한 GenealogyChart 컴포넌트 재사용 (targetUserId 전달)
          <GenealogyChart targetUserId={contextSelectedUser.userId} title="" viewMode="FULL" />
        )}
      </Dialog>
      <UserFormModal
        visible={isModalVisible}
        onHide={() => setIsModalVisible(false)}
        onSave={handleSave}
        userIdToEdit={selectedUserId}
      />

      <div className="page-flex-container">
        <Card header={cardHeader} className="card-flex-full">
          {loading ? (
            <div className="text-center p-4">
              <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
            </div>
          ) : (
            <ReusableDataTable<User>
              value={rows}
              editMode={undefined} // 인라인 편집 미사용
              dataKey="userId"
              editingRows={undefined}
              onRowEditComplete={() => {}} // 미사용
              onRowEditChange={() => {}} // 미사용
              useHeader
              useGlobalFilter
              globalFilterValue={globalFilter}
              onGlobalFilterChange={setGlobalFilter}
              onReload={loadRows}
              loading={loading}
              usePagination
              filterDisplay="row"
              defaultRows={10}
              scrollHeight="flex"
              filters={filters}
              onFilter={(e) => setFilters(e.filters)}
              contextMenuSelection={contextSelectedUser ?? undefined}
              onContextMenuSelectionChange={(e) => setContextSelectedUser(e.value)}
              onContextMenu={(e) => {
                const clickedUser = e.data as User;

                setContextSelectedUser(clickedUser);

                cm.current?.show(e.originalEvent);
              }}
            >
              {userCols}
            </ReusableDataTable>
          )}
        </Card>
      </div>
    </>
  );
}
