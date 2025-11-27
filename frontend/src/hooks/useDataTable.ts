import { useState, useCallback } from 'react';
import type { RefObject } from 'react';
import api from 'src/api/axios';
import type { Toast } from 'primereact/toast';
import type {
  DataTableRowEditCompleteEvent,
  DataTableRowEditEvent,
  DataTableEditingRows,
} from 'primereact/datatable';

import type { WithCrud } from 'src/config/types/GridTypes';

type CrudRow<T> = WithCrud<T>;

interface UseDataTableOptions<T extends Record<string, any>> {
  apiBaseUrl: string;
  idField: keyof T;
  toast: RefObject<Toast | null>;
  newRowDefaults: Omit<T, keyof T & string>;
}

export const useDataTable = <T extends { [key: string]: any }>({
  apiBaseUrl,
  idField,
  toast,
  newRowDefaults,
}: UseDataTableOptions<T>) => {
  // ... (useState 훅들)
  const [rows, setRows] = useState<CrudRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRows, setEditingRows] = useState<DataTableEditingRows | undefined>(undefined);
  const [globalFilter, setGlobalFilter] = useState('');

  // ... (loadRows, onRowEditComplete 함수는 동일)
  const loadRows = useCallback(
    async (params?: any) => {
      setLoading(true);
      try {
        const { data } = await api.get<T[]>(apiBaseUrl, { params });
        setRows(data.map((item) => ({ ...item })));
      } catch (e) {
        console.error('데이터 로드 실패', e);
        toast.current?.show({ severity: 'error', summary: 'Error', detail: '데이터 조회 실패' });
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, toast],
  );

  const onRowEditComplete = useCallback(
    async (e: DataTableRowEditCompleteEvent) => {
      const { newData } = e as { newData: CrudRow<T> };

      try {
        if (newData.isNew) {
          // C (Create)
          const { [idField]: id, isNew, ...payload } = newData;
          await api.post(apiBaseUrl, payload);
        } else {
          // U (Update) - PATCH
          await api.patch(`${apiBaseUrl}/${newData[idField]}`, newData);
        }
        toast.current?.show({ severity: 'success', summary: 'Success', detail: '저장 완료' });
        setEditingRows(undefined);
        await loadRows();
      } catch (error: any) {
        console.error('저장 실패', error);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || '저장 실패',
        });
        throw error;
      }
    },
    [apiBaseUrl, idField, loadRows, toast],
  );

  /** 3. 편집 상태 변경 (Cancel) */
  const onRowEditChange = useCallback(
    (e: DataTableRowEditEvent) => {
      const newEditingRows = e.data as DataTableEditingRows;
      setEditingRows(newEditingRows);

      const editingKeys = Object.keys(newEditingRows || {});
      setRows((prevRows) =>
        prevRows.filter((row) => {
          if (!row.isNew) return true;
          return editingKeys.includes(String(row[idField]));
        }),
      );
    },
    [idField],
  );

  // ... (addRowAndEdit, deleteRow 함수는 동일)
  const addRowAndEdit = useCallback(() => {
    // ❗️'rows' 상태를 직접 참조하는 대신, 'setRows'의 함수형 업데이트를 사용합니다.
    setRows((prevRows) => {
      // 'rows' 대신 'prevRows'를 사용합니다.
      if (prevRows.find((r) => r.isNew)) {
        toast.current?.show({
          severity: 'warn',
          summary: '알림',
          detail: '이미 추가 중인 항목이 있습니다.',
        });
        return prevRows; // 상태 변경 없음 (루프 방지)
      }

      const tempId = `new_${Date.now()}`;
      const newRow: CrudRow<T> = {
        ...(newRowDefaults as T),
        [idField]: tempId,
        isNew: true,
      };

      setEditingRows({ [tempId]: true });
      return [newRow, ...prevRows]; // 새로운 'rows' 배열 반환
    });
  }, [toast, newRowDefaults, idField]);

  const deleteRow = useCallback(
    async (rowToDelete: CrudRow<T>) => {
      if (rowToDelete.isNew) {
        setRows((prev) => prev.filter((row) => row[idField] !== rowToDelete[idField]));
        return;
      }
      try {
        await api.patch(`${apiBaseUrl}/toggle/${rowToDelete[idField]}`);
        const actionLabel = rowToDelete.isActive ? '비활성' : '복구';
        toast.current?.show({
          severity: 'success',
          summary: `${actionLabel} 완료`,
        });
        await loadRows();
      } catch (error: any) {
        console.error('삭제/복구 실패', error);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || '처리 실패',
        });
      }
    },
    [apiBaseUrl, idField, loadRows, toast],
  );

  return {
    rows,
    loading,
    editingRows,
    globalFilter,
    setGlobalFilter,
    loadRows,
    onRowEditComplete,
    onRowEditChange,
    addRowAndEdit,
    deleteRow,
  };
};
