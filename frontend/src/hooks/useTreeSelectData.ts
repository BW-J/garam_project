import { useState, useEffect, useMemo } from 'react';
import api from 'src/api/axios';
import { buildTreeFromFlat, mapToPrimeTreeSelectNodes } from 'src/utils/treeUtils';
import type { PrimeTreeNode } from 'src/utils/treeUtils';

interface UseTreeSelectDataParams {
  apiUrl: string; // (예: '/system/department')
  idField: string; // (예: 'deptId')
  parentField: string; // (예: 'parentDeptId')
  labelField: string; // (예: 'deptNm')
}

/**
 * API에서 Flat List를 가져와 TreeSelect 옵션용 트리로 가공하는 공통 훅
 */
export const useTreeSelectData = ({
  apiUrl,
  idField,
  parentField,
  labelField,
}: UseTreeSelectDataParams) => {
  // 1. 원본 트리 구조 (PrimeTreeNode)
  const [nodes, setNodes] = useState<PrimeTreeNode<any>[]>([]);
  const [loading, setLoading] = useState(false);

  // 2. API에서 데이터 로드
  useEffect(() => {
    setLoading(true);
    api
      .get(apiUrl)
      .then((res) => {
        // 3. Flat List -> Tree 변환
        const tree = buildTreeFromFlat(res.data, idField, parentField);
        setNodes(tree);
      })
      .catch((err) => console.error(`[${apiUrl}] Tree data load failed`, err))
      .finally(() => setLoading(false));
  }, [apiUrl, idField, parentField]); // API URL 등이 변경되면 데이터 다시 로드

  // 4. Tree -> TreeSelect 옵션 변환 (mapToPrimeTreeSelectNodes 사용)
  const treeSelectOptions = useMemo(
    () => mapToPrimeTreeSelectNodes(nodes, labelField),
    [nodes, labelField],
  );

  return { options: treeSelectOptions, loading };
};
