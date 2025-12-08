import { useState, useRef, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Checkbox } from 'primereact/checkbox';
import { FileUpload } from 'primereact/fileupload';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import { useForm, Controller } from 'react-hook-form';
import api from 'src/api/axios';
import type { Attachment, Board } from 'src/config/types/Board';
import { ProgressSpinner } from 'primereact/progressspinner';

interface BoardFormModalProps {
  boardType: string;
  visible: boolean;
  onHide: () => void;
  onSave: () => void;
  boardIdToEdit: number | null;
}

export default function BoardFormModal({
  boardType,
  visible,
  onHide,
  onSave,
  boardIdToEdit,
}: BoardFormModalProps) {
  const toast = useRef<Toast | null>(null);
  const fileUploadRef = useRef<FileUpload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);

  const isEdit = boardIdToEdit !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      content: '',
      isImportant: false,
    },
  });

  // 모달 열릴 때 초기값 설정
  useEffect(() => {
    reset({ title: '', content: '', isImportant: false });
    fileUploadRef.current?.clear();
    setExistingAttachments([]);
    setDeletedAttachmentIds([]);

    if (visible && isEdit) {
      setFetching(true);
      api
        .get(`/board/${boardType}/${boardIdToEdit}`)
        .then((res) => {
          const board: Board = res.data;
          reset({
            title: board.title,
            content: board.content,
            isImportant: board.isImportant,
          });
          setExistingAttachments(board.attachments || []);
        })
        .catch((err) => {
          console.error('수정할 게시글 로드 실패', err);
          onHide(); // 로드 실패 시 모달 닫기
        })
        .finally(() => setFetching(false));
    }
  }, [visible, isEdit, boardIdToEdit, boardType, reset, onHide]);

  const handleRemoveExistingFile = (attachId: number) => {
    // UI에서 숨김
    setExistingAttachments((prev) => prev.filter((f) => f.attachId !== attachId));
    // 삭제 목록에 추가
    setDeletedAttachmentIds((prev) => [...prev, attachId]);
  };

  const handleDownload = async (attachId: number, fileName: string) => {
    try {
      const blobData = await api.get(`/board/${boardType}/download/${attachId}`, {
        responseType: 'blob',
      });
      const blob = blobData as unknown as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: '다운로드 실패' });
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('content', data.content);
      formData.append('isImportant', String(data.isImportant)); // boolean -> string 변환
      const newFiles = fileUploadRef.current?.getFiles() || [];
      for (const file of newFiles) {
        formData.append('files', file);
      }

      let url = `/board/${boardType}`;
      let method: 'post' | 'patch' = 'post';

      if (isEdit) {
        method = 'patch';
        url = `${url}/${boardIdToEdit}`;
        formData.append('deletedAttachmentIds', JSON.stringify(deletedAttachmentIds));
      }
      await api[method](url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.current?.show({ severity: 'success', summary: '저장 완료' });
      onSave();
      onHide();
    } catch (e: any) {
      console.error('게시글 저장 실패', e);
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: e.response?.data?.message || e.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '500px' }}
      breakpoints={{ '1440px': '50vw', '960px': '75vw', '641px': '95vw' }}
      header={isEdit ? '게시글 수정' : '새 게시글 작성'}
      modal
      className="p-fluid"
      onHide={onHide}
    >
      <Toast ref={toast} />
      {fetching ? (
        <ProgressSpinner />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-column gap-3 mt-4">
          {/* 제목 */}
          <div className="field">
            <span className="p-float-label">
              <Controller
                name="title"
                control={control}
                rules={{ required: '제목을 입력해주세요.' }}
                render={({ field, fieldState }) => (
                  <InputText
                    id={field.name}
                    {...field}
                    className={classNames({ 'p-invalid': fieldState.invalid })}
                  />
                )}
              />
              <label htmlFor="title">제목 *</label>
            </span>
            {errors.title && <small className="p-error">{errors.title.message?.toString()}</small>}
          </div>

          {/* 중요 공지 여부 (관리자만 보이게 처리 필요할 수도 있음) */}
          <div className="field-checkbox">
            <Controller
              name="isImportant"
              control={control}
              render={({ field }) => (
                <Checkbox
                  inputId={field.name}
                  onChange={(e) => field.onChange(e.checked)}
                  checked={field.value}
                />
              )}
            />
            <label htmlFor="isImportant" className="ml-2">
              중요 게시글 (상단 고정)
            </label>
          </div>

          {/* 내용 */}
          <div className="field">
            <span className="p-float-label">
              <Controller
                name="content"
                control={control}
                rules={{ required: '내용을 입력해주세요.' }}
                render={({ field, fieldState }) => (
                  <InputTextarea
                    id={field.name}
                    {...field}
                    rows={10}
                    className={classNames({ 'p-invalid': fieldState.invalid })}
                    style={{ resize: 'none' }}
                  />
                )}
              />
              <label htmlFor="content">내용 *</label>
            </span>
            {errors.content && (
              <small className="p-error">{errors.content.message?.toString()}</small>
            )}
          </div>

          {/* 파일 업로드 (신규 작성 시에만 허용 - 수정 시 파일 관리는 별도 구현 필요) */}
          <div className="field">
            <label className="mb-2 block">첨부파일</label>
            <FileUpload
              ref={fileUploadRef}
              name="files"
              multiple
              maxFileSize={10000000} // 10MB
              emptyTemplate={<p className="m-0">파일을 여기로 드래그하거나 선택하세요.</p>}
              chooseLabel="파일 선택"
              uploadOptions={{ style: { display: 'none' } }} // 기본 업로드 버튼 숨김
              cancelOptions={{ style: { display: 'none' } }} // 기본 취소 버튼 숨김
            />
          </div>
          {isEdit && existingAttachments.length > 0 && (
            <div className="field">
              <label className="mb-2 block">기존 첨부파일</label>
              <ul className="list-none p-0 m-0">
                {existingAttachments.map((file) => (
                  <li
                    key={file.attachId}
                    className="flex align-items-center justify-content-between p-2 surface-border border-1 border-round mb-1"
                  >
                    {/* 1. 파일명 (다운로드 링크) */}
                    <div
                      className="flex align-items-center gap-2 overflow-hidden"
                      style={{ maxWidth: 'calc(100% - 3rem)' }}
                    >
                      <i className="pi pi-file text-primary flex-shrink-0" />
                      <span
                        className="text-primary cursor-pointer hover:underline font-medium white-space-nowrap overflow-hidden text-overflow-ellipsis"
                        onClick={() => handleDownload(file.attachId, file.originalName)}
                        title={`다운로드: ${file.originalName}`}
                      >
                        {file.originalName}
                      </span>
                      <span className="text-color-secondary text-sm flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>

                    {/* 2. 삭제 버튼 (X) */}
                    <Button
                      icon="pi pi-times"
                      className="p-button-danger p-button-text p-button-sm flex-shrink-0"
                      onClick={() => handleRemoveExistingFile(file.attachId)}
                      title="이 파일 삭제"
                      type="button"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-content-end gap-2 mt-3">
            <Button label="취소" icon="pi pi-times" outlined onClick={onHide} type="button" />
            <Button label="저장" icon="pi pi-check" type="submit" loading={loading} />
          </div>
        </form>
      )}
    </Dialog>
  );
}
