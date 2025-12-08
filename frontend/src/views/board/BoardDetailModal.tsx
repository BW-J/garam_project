import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import type { Board } from 'src/config/types/Board';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import api from 'src/api/axios';
import { useAuthStore } from 'src/store/authStore';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

interface BoardDetailModalProps {
  boardType: string;
  visible: boolean;
  onHide: () => void;
  boardId: number | null;
  canDelete?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  canEdit?: boolean;
}

export default function BoardDetailModal({
  boardType,
  visible,
  onHide,
  boardId,
  canDelete = false,
  onDelete,
  onEdit,
  canEdit = false,
}: BoardDetailModalProps) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [boardData, setBoardData] = useState<Board | null>(null);
  const user = useAuthStore((state) => state.user);

  // 모달이 열리거나 boardId가 바뀌면 데이터 새로 로드
  useEffect(() => {
    if (visible && boardId) {
      setLoading(true);
      // API 호출로 최신 데이터 가져오기 (조회수 증가 포함)
      api
        .get(`/board/${boardType}/${boardId}`)
        .then((res) => setBoardData(res.data))
        .catch((err) => console.error('상세 조회 실패', err))
        .finally(() => setLoading(false));
    } else {
      setBoardData(null); // 닫힐 때 초기화
    }
  }, [visible, boardId, boardType]);

  const showEditButton = useMemo(() => {
    if (!user || !boardData) return false;
    if (user.isSuperAdmin) return true; // 1. 슈퍼어드민
    //if (canEdit) return true;
    if (boardData.author?.userId === user.userId) return true; // 3. 작성자
    return false;
  }, [user, boardData, canEdit]);

  const showDeleteButton = useMemo(() => {
    if (!user || !boardData) return false;
    if (user.isSuperAdmin) return true; // 1. 슈퍼어드민
    //if (canDelete) return true;
    if (boardData.author?.userId === user.userId) return true; // 3. 작성자
    return false;
  }, [user, boardData, canDelete]);

  const handleDelete = () => {
    confirmDialog({
      message: '게시글을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      header: '삭제 확인',
      icon: 'pi pi-info-circle',
      acceptClassName: 'p-button-danger',
      acceptLabel: '삭제',
      rejectLabel: '취소',
      accept: async () => {
        if (!boardId) return;
        try {
          await api.delete(`/board/${boardType}/${boardId}`);
          toast.current?.show({ severity: 'success', summary: '삭제 완료' });
          onDelete(); // 부모(List)에게 알려서 새로고침
          onHide(); // 모달 닫기
        } catch (err: any) {
          toast.current?.show({
            severity: 'error',
            summary: '삭제 실패',
            detail: err.response?.data?.message || '오류가 발생했습니다.',
          });
        }
      },
    });
  };

  const handleDownload = async (attachId: number, fileName: string) => {
    try {
      // 1. axios로 바이너리 데이터 요청 (토큰 자동 포함됨)
      const response = await api.get(`/board/${boardType}/download/${attachId}`, {
        responseType: 'blob',
      });
      const blob = response as unknown as Blob;

      const url = window.URL.createObjectURL(blob);
      // 더 간단한 해결책: 다운로드용 링크 생성
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName); // 다운로드될 파일명 설정
      document.body.appendChild(link);
      link.click(); // 클릭 이벤트 발생시켜 다운로드

      // 3. 뒷정리
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof Blob) {
        const text = await error.text();
        console.error('서버 응답 (Blob → 텍스트):', text);
      }
      console.error('파일 다운로드 실패', error);
      // toast.current?.show({ severity: 'error', summary: '다운로드 실패', detail: '파일을 다운로드할 수 없습니다.' });
    }
  };

  if (!visible) return null;

  // 헤더 렌더링 (데이터 로드 전에는 빈 상태)
  const header = boardData && (
    <div className="flex align-items-center gap-2" style={{ maxWidth: '90%' }}>
      {boardData.isImportant && <Tag severity="danger" value="중요" className="flex-shrink-0" />}
      <span className="text-xl font-bold white-space-nowrap overflow-hidden text-overflow-ellipsis">
        {boardData.title}
      </span>
    </div>
  );

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={header}
      modal
      className="responsive-dialog"
      style={{ width: '800px' }}
      maximizable
      dismissableMask
    >
      <Toast ref={toast} />
      <ConfirmDialog />
      {loading || !boardData ? (
        <div
          className="flex justify-content-center align-items-center"
          style={{ minHeight: '300px' }}
        >
          <ProgressSpinner />
        </div>
      ) : (
        <>
          {/* 메타 정보 (작성자, 작성일, 조회수) */}
          <div className="flex flex-wrap justify-content-between text-color-secondary text-sm mb-3 gap-2">
            <div>
              <span className="font-bold mr-2">작성자:</span> {boardData.author?.userNm}
            </div>
            <div className="flex gap-3">
              <span>
                <span className="font-bold mr-2">작성일:</span>
                {new Date(boardData.createdAt).toLocaleDateString()}
              </span>
              <span>
                <span className="font-bold mr-2">조회수:</span> {boardData.viewCount}
              </span>
            </div>
          </div>

          <Divider />

          {/* 본문 내용 */}
          <div
            className="line-height-3 text-lg py-3"
            style={{ minHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {boardData.content}
          </div>

          {/* 첨부파일 영역 */}
          {boardData.attachments && boardData.attachments.length > 0 && (
            <div className="surface-ground p-3 border-round mt-4">
              <div className="mb-2 font-bold flex align-items-center">
                <i className="pi pi-folder-open mr-2"></i>
                첨부파일 ({boardData.attachments.length})
              </div>
              <ul className="list-none p-0 m-0">
                {boardData.attachments.map((file) => (
                  <li
                    key={file.attachId}
                    className="flex align-items-center gap-2 py-2 border-bottom-1 surface-border"
                  >
                    <i className="pi pi-file text-primary" />
                    <span
                      className="text-primary cursor-pointer hover:underline font-medium"
                      onClick={() => handleDownload(file.attachId, file.originalName)}
                    >
                      {file.originalName}
                    </span>
                    <span className="text-color-secondary text-sm ml-2">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex justify-content-end mt-4">
        {showEditButton && (
          <Button label="수정" icon="pi pi-pencil" className="p-button-text" onClick={onEdit} />
        )}
        {showDeleteButton ? (
          <Button
            label="삭제"
            icon="pi pi-trash"
            className="p-button-danger p-button-text"
            onClick={handleDelete}
          />
        ) : (
          <div /> // 우측 정렬을 위한 빈 공간
        )}
        <Button label="닫기" icon="pi pi-times" onClick={onHide} />
      </div>
    </Dialog>
  );
}
