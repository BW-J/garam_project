import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { ReusableDataTable } from 'src/components/grid/ReusableDataTable';
import type { Board, BoardSearchParams } from 'src/config/types/Board';
import api from 'src/api/axios';
import BoardDetailModal from './BoardDetailModal';
import BoardFormModal from './BoardFormModal';

interface GenericBoardListProps {
  boardType: string;
  boardTitle: string;
  canWrite?: boolean; // 글쓰기 권한 여부 (부모가 결정해서 전달)
  canDelete?: boolean;
  canEdit?: boolean;
}

export default function GenericBoardList({
  boardType,
  boardTitle,
  canWrite = false,
  canDelete = false,
  canEdit = false,
}: GenericBoardListProps) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Board[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  const onRefreshList = () => {
    loadPosts(); // 기존 loadPosts 함수 재사용
  };

  // 페이징 & 검색 상태
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 10,
    page: 1,
  });
  const [searchType, setSearchType] = useState<string>(''); // ''(전체), 'title', 'content', 'author'
  const [keyword, setKeyword] = useState('');

  // 모달 상태
  const [detailVisible, setDetailVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  // 데이터 로드
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params: BoardSearchParams = {
        page: lazyParams.page,
        limit: lazyParams.rows,
        keyword: keyword || undefined,
        searchType: (searchType as any) || undefined,
      };

      const res = await api.get(`/board/${boardType}`, { params });
      setPosts(res.data.data);
      setTotalRecords(res.data.meta.total);
    } catch (e: any) {
      toast.current?.show({ severity: 'error', summary: '목록 로드 실패', detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [boardType, lazyParams, keyword, searchType]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // 페이징 이벤트 핸들러
  const onPage = (event: any) => {
    setLazyParams({
      first: event.first,
      rows: event.rows,
      page: event.page + 1, // 백엔드는 1-based page를 사용하므로 +1
    });
  };

  // 검색 핸들러
  const onSearch = () => {
    setLazyParams((prev) => ({ ...prev, first: 0, page: 1 })); // 검색 시 1페이지로 초기화
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  // 상세 보기 (행 클릭)
  const onRowClick = (e: any) => {
    setSelectedBoardId(e.data.boardId);
    setDetailVisible(true);
  };

  // 글쓰기
  const openWriteModal = () => {
    setSelectedBoardId(null);
    setFormVisible(true);
  };

  // 수정
  const openEditModal = () => {
    setDetailVisible(false); // 상세 모달 닫고
    setFormVisible(true); // 폼 모달 열기 (ID가 있으므로 '수정' 모드로 동작)
  };

  // --- 렌더링 헬퍼 ---
  const dateBody = (rowData: Board) => {
    return new Date(rowData.createdAt).toLocaleDateString();
  };

  const attachmentBody = (rowData: Board) => {
    if (rowData.attachments && rowData.attachments.length > 0) {
      return <i className="pi pi-paperclip text-primary" />;
    }
    return null;
  };

  const titleBody = (rowData: Board) => {
    return (
      <div className="flex align-items-center gap-2">
        {rowData.isImportant && <Tag severity="danger" value="중요" className="px-2 py-0" />}
        <span
          className="white-space-nowrap overflow-hidden text-overflow-ellipsis"
          style={{ maxWidth: '300px' }}
        >
          {rowData.title}
        </span>
        {/* 새 글 표시 (예: 24시간 이내) 로직 추가 가능 */}
      </div>
    );
  };

  // 검색 옵션
  const searchOptions = [
    { label: '전체 (제목+내용)', value: '' },
    { label: '제목', value: 'title' },
    { label: '내용', value: 'content' },
    { label: '작성자', value: 'author' },
  ];

  const cardHeader = (
    <div className="flex flex-column md:flex-row justify-content-between md:align-items-center gap-3 p-3">
      <span className="p-card-title white-space-nowrap">{boardTitle}</span>

      <div className="flex flex-wrap gap-2 align-items-center w-full md:w-auto">
        {/* 검색 영역 */}
        <div className="flex w-full md:w-auto p-inputgroup" style={{ maxWidth: '400px' }}>
          <Dropdown
            value={searchType}
            options={searchOptions}
            onChange={(e) => setSearchType(e.value)}
            placeholder="검색 조건"
            className="flex-shrink-0"
            style={{ width: '8rem' }}
          />
          <InputText
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="검색어 입력"
            className="w-full"
          />
          <Button icon="pi pi-search" onClick={onSearch} />
        </div>

        {/* 버튼 영역 */}
        {canWrite && (
          <Button
            label="글쓰기"
            icon="pi pi-pencil"
            onClick={() => openWriteModal()}
            className="flex-shrink-0"
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="page-flex-container">
      <Toast ref={toast} />

      {/* 상세 모달 */}
      <BoardDetailModal
        boardType={boardType}
        visible={detailVisible}
        onHide={() => setDetailVisible(false)}
        boardId={selectedBoardId}
        canDelete={canDelete}
        onDelete={onRefreshList}
        onEdit={openEditModal}
        canEdit={canEdit}
      />

      {/* 작성/수정 모달 */}
      {canWrite && (
        <BoardFormModal
          boardType={boardType}
          visible={formVisible}
          onHide={() => setFormVisible(false)}
          onSave={onRefreshList}
          boardIdToEdit={selectedBoardId}
        />
      )}

      <Card header={cardHeader} className="card-flex-full">
        <ReusableDataTable<Board>
          value={posts}
          dataKey="boardId"
          lazy={true}
          paginator={true}
          first={lazyParams.first}
          rows={lazyParams.rows}
          totalRecords={totalRecords}
          onPage={onPage}
          loading={loading}
          //usePagination
          paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          currentPageReportTemplate="{first} ~ {last} / 총 {totalRecords} 건"
          rowsPerPageOptions={[5, 10, 25, 50]}
          useHeader={false} // 커스텀 헤더 사용
          selectionMode="single"
          metaKeySelection={false}
          onRowClick={onRowClick}
          rowHover
          scrollHeight="flex"
        >
          <Column
            field="boardId"
            header="No."
            className="hidden-on-mobile"
            style={{ width: '5rem', textAlign: 'center' }}
          />
          <Column field="title" header="제목" body={titleBody} style={{ minWidth: '15rem' }} />
          <Column
            field="attachments"
            header="첨부"
            body={attachmentBody}
            style={{ width: '4rem', textAlign: 'center' }}
          />
          <Column
            field="author.userNm"
            header="작성자"
            className="hidden-on-mobile"
            style={{ width: '8rem', textAlign: 'center' }}
          />
          <Column
            field="createdAt"
            header="작성일"
            body={dateBody}
            style={{ width: '8rem', textAlign: 'center' }}
          />
          <Column
            field="viewCount"
            header="조회"
            className="hidden-on-mobile"
            style={{ width: '5rem', textAlign: 'center' }}
          />
        </ReusableDataTable>
      </Card>
    </div>
  );
}
