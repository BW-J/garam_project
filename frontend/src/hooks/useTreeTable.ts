import { useCallback, useState } from 'react';
import type { PrimeTreeNode } from 'src/utils/treeUtils';
import {
  buildTreeFromFlat,
  countTotalNodes,
  findNodeByKey,
  mapApiToPrimeTree,
} from 'src/utils/treeUtils';
import type { Toast } from 'primereact/toast';
import api from 'src/api/axios';
import type { TreeTableFilterMeta } from 'primereact/treetable';

export interface UseTreeTableParams<T extends Record<string, any>> {
  apiBaseUrl: string;
  idField: keyof T;
  parentIdField?: keyof T;
  newRowDefaults: Partial<T>;
  toastRef?: React.RefObject<Toast | null>;
  parentObjectField?: keyof T;
}

export function useTreeTable<T extends Record<string, any>>(params: UseTreeTableParams<T>) {
  const { apiBaseUrl, idField, parentIdField, parentObjectField, newRowDefaults, toastRef } =
    params;

  const [nodes, setNodes] = useState<PrimeTreeNode<T>[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string>();
  const [editingRowData, setEditingRowData] = useState<T>();
  const [originalRowData, setOriginalRowData] = useState<T>();
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [totalNodeCount, setTotalNodeCount] = useState(0);
  const [filters, setFilters] = useState<Record<string, any>>({
    isActive: { value: true, matchMode: 'equals' },
  });

  /** [수정] 필터 상태를 업데이트하는 핸들러 */
  const onFilter = useCallback((filters: TreeTableFilterMeta) => {
    setFilters(filters);
  }, []);

  /** 내부 유틸: 특정 key의 data 교체 (immutable) */
  const replaceNodeDataByKey = useCallback((key: string, newData: T) => {
    const walk = (arr: PrimeTreeNode<T>[]): PrimeTreeNode<T>[] =>
      arr.map((n) =>
        n.key === key
          ? { ...n, data: { ...newData } }
          : { ...n, children: n.children ? walk(n.children) : [] },
      );
    setNodes((prev) => walk(prev));
  }, []);

  /** 내부 유틸: 특정 key 노드 제거 (immutable) */
  const removeNodeByKey = useCallback((key: string) => {
    const remove = (arr: PrimeTreeNode<T>[]): PrimeTreeNode<T>[] =>
      arr
        .filter((n) => n.key !== key)
        .map((n) => ({ ...n, children: n.children ? remove(n.children) : [] }));
    setNodes((prev) => remove(prev));
  }, []);

  /** 데이터 로드: flat/tree 자동 감지 */
  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(apiBaseUrl);
      let tree: PrimeTreeNode<T>[];

      if (data.length > 0 && 'children' in data[0] && Array.isArray(data[0].children)) {
        tree = mapApiToPrimeTree<T>(data, idField);
      } else if (data.length > 0 && parentIdField && parentIdField in data[0]) {
        tree = buildTreeFromFlat<T>(data, idField, parentIdField);
      } else {
        tree = mapApiToPrimeTree<T>(data, idField);
      }
      const total = countTotalNodes(tree);
      setTotalNodeCount(total);

      setNodes(tree);
    } catch (e) {
      toastRef?.current?.show({
        severity: 'error',
        summary: '로드 실패',
        detail: String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, idField, parentIdField, toastRef]);

  /** 편집 시작: 원본 스냅샷 저장 */
  const startEdit = (node: PrimeTreeNode<T>) => {
    cancelEdit();
    setEditingKey(String(node.key));
    setEditingRowData({ ...node.data });
    setOriginalRowData({ ...node.data });
  };

  /** 편집 취소: 임시행이면 제거, 아니면 원본으로 롤백 */
  const cancelEdit = () => {
    if (!editingKey) {
      setEditingRowData(undefined);
      setOriginalRowData(undefined);
      return;
    }
    const isNew = (editingRowData as any)?.isNew === true;
    if (isNew) {
      removeNodeByKey(editingKey);
    } else if (originalRowData) {
      replaceNodeDataByKey(editingKey, originalRowData as T);
    }
    setEditingKey(undefined);
    setEditingRowData(undefined);
    setOriginalRowData(undefined);
  };

  /** 에디터에서 값 변경 시: 편집 데이터 + 화면 데이터 동시 업데이트 */
  const setEditingData = (field: keyof T | string, value: any) => {
    setEditingRowData((prev) => {
      if (!prev || !editingKey) return prev;
      let next = { ...prev, [field as keyof T]: value } as T;
      if (field === parentIdField && parentObjectField) {
        const newParentNode = value ? findNodeByKey(nodes, String(value)) : undefined;
        const newParentData = newParentNode ? newParentNode.data : null;
        next = { ...next, [parentObjectField]: newParentData };
      }
      replaceNodeDataByKey(editingKey, next);
      return next;
    });
  };

  /** 저장 (신규/수정) */
  const saveEdit = useCallback(
    async (node: PrimeTreeNode<T>) => {
      try {
        const payload = { ...node.data };
        const isNew = (payload as any).isNew;
        const id = payload[idField];

        delete (payload as any).isNew;
        if (parentObjectField) {
          delete (payload as any)[parentObjectField];
        }

        if (isNew) {
          await api.post(apiBaseUrl, payload);
        } else {
          await api.patch(`${apiBaseUrl}/${id}`, payload);
        }

        toastRef?.current?.show({
          severity: 'success',
          summary: '저장 완료',
          detail: '정상적으로 저장되었습니다.',
        });

        await loadNodes();
        setEditingKey(undefined);
        setEditingRowData(undefined);
        setOriginalRowData(undefined);
      } catch (e: any) {
        toastRef?.current?.show({
          severity: 'error',
          summary: '저장 실패',
          detail: e.response.data.message || e.message || String(e),
        });
      }
    },
    [apiBaseUrl, idField, loadNodes, toastRef, parentObjectField],
  );

  /** 삭제 */
  const deleteNode = useCallback(
    async (target: PrimeTreeNode<T>) => {
      try {
        const id = (target.data as any)[idField];
        const isActive = (target.data as any).isActive;

        await api.patch(`${apiBaseUrl}/toggle/${id}`);
        const actionLabel = isActive ? '비활성' : '복구';
        const severity = isActive ? 'warn' : 'success';
        toastRef?.current?.show({
          severity,
          summary: `${actionLabel} 완료`,
        });
        await loadNodes();
      } catch (e: any) {
        toastRef?.current?.show({
          severity: 'error',
          summary: '처리 실패',
          detail: e.response.data.message || e.message || String(e),
        });
      }
    },
    [apiBaseUrl, idField, loadNodes, toastRef],
  );

  /** 최상위 추가: 맨 위에 + 즉시 편집 */
  const addRootNode = () => {
    cancelEdit();
    const newKey = `temp-${Date.now()}`;
    const data = { ...(newRowDefaults as T), isNew: true } as T;

    const newNode: PrimeTreeNode<T> = {
      key: newKey,
      data,
      children: [],
    };

    setNodes((prev) => [newNode, ...prev]);
    setEditingKey(newKey);
    setEditingRowData({ ...data });
    setOriginalRowData({ ...data });
  };

  /** 하위 추가: 부모의 첫번째 자식으로 + 즉시 편집 */
  const addChildNode = (parent: PrimeTreeNode<T>) => {
    cancelEdit();
    const newKey = `temp-${Date.now()}`;
    const data = {
      ...(newRowDefaults as T),
      isNew: true,
      [parentIdField as string]: parent.data[idField],
    } as T;

    const child: PrimeTreeNode<T> = { key: newKey, data, children: [] };

    const addDeep = (nodes: PrimeTreeNode<T>[]): PrimeTreeNode<T>[] => {
      return nodes.map((n) => {
        if (n.key === parent.key) {
          return {
            ...n,
            children: n.children ? [child, ...n.children] : [child],
          };
        }
        if (n.children) {
          return { ...n, children: addDeep(n.children) };
        }
        return n;
      });
    };

    setNodes((prev) => addDeep(prev));
    setExpandedKeys((prev) => ({ ...prev, [parent.key!]: true }));
    setEditingKey(newKey);
    setEditingRowData({ ...data });
    setOriginalRowData({ ...data });
  };

  return {
    // state
    nodes,
    loading,
    expandedKeys,
    editingKey,
    editingRowData,
    globalFilter,
    filters, // [수정] 반환

    // setters
    setGlobalFilter,
    setExpandedKeys,
    onFilter, // [수정] 반환

    // actions
    loadNodes,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNode,
    setEditingData,
    addRootNode,
    addChildNode,
    totalNodeCount,
  };
}
