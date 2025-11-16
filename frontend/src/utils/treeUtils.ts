/**
 * PrimeReact TreeTable용 트리 유틸리티
 * - ApiNode<T>: 서버(children) 응답 구조
 * - PrimeTreeNode<T>: PrimeReact TreeTable 구조
 * - buildTreeFromFlat: flat -> PrimeTreeNode
 * - mapApiToPrimeTree: tree(children) -> PrimeTreeNode
 * - addNodeToTree / updateNodeInTree / deleteNodeFromTree / findNodeByKey
 */

export type ApiNode<T extends Record<string, any>> = T & {
  children?: ApiNode<T>[];
};

export interface PrimeTreeNode<T> {
  key: string;
  data: T;
  children?: PrimeTreeNode<T>[];
}

/** flat 배열을 parentId 기준으로 PrimeTreeNode 트리 구성 */
export function buildTreeFromFlat<T extends Record<string, any>>(
  items: T[],
  idField: keyof T,
  parentField: keyof T,
): PrimeTreeNode<T>[] {
  const map = new Map<string, PrimeTreeNode<T>>();
  const roots: PrimeTreeNode<T>[] = [];

  // 모든 노드를 미리 생성
  for (const item of items) {
    const key = String(item[idField]);
    map.set(key, { key, data: item, children: [] });
  }

  // 부모-자식 연결
  for (const item of items) {
    const key = String(item[idField]);
    const parentKey = item[parentField] != null ? String(item[parentField]) : '';
    const node = map.get(key);
    const parent = map.get(parentKey);

    if (node) {
      if (parent) parent.children!.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

/** children 구조의 API 응답을 PrimeTreeNode로 변환 */
export function mapApiToPrimeTree<T extends Record<string, any>>(
  nodes: ApiNode<T>[] = [],
  keyField: keyof T,
): PrimeTreeNode<T>[] {
  return nodes.map((node) => ({
    key: String(node[keyField] ?? crypto.randomUUID()),
    data: { ...(node as T) },
    children: node.children?.length ? mapApiToPrimeTree(node.children, keyField) : [],
  }));
}

/** 특정 key 노드 찾기 */
export function findNodeByKey<T>(
  nodes: PrimeTreeNode<T>[],
  key: string,
): PrimeTreeNode<T> | undefined {
  for (const n of nodes) {
    if (n.key === key) return n;
    if (n.children?.length) {
      const found = findNodeByKey(n.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

/** 특정 key 노드의 data 갱신 (immutable) */
export function updateNodeInTree<T>(
  nodes: PrimeTreeNode<T>[],
  key: string,
  newData: Partial<T>,
): PrimeTreeNode<T>[] {
  return nodes.map((n) =>
    n.key === key
      ? { ...n, data: { ...n.data, ...newData } }
      : { ...n, children: n.children ? updateNodeInTree(n.children, key, newData) : [] },
  );
}

/** 특정 key 노드 삭제 (immutable) */
export function deleteNodeFromTree<T>(nodes: PrimeTreeNode<T>[], key: string): PrimeTreeNode<T>[] {
  return nodes
    .filter((n) => n.key !== key)
    .map((n) => ({
      ...n,
      children: n.children ? deleteNodeFromTree(n.children, key) : [],
    }));
}

/** parentKey 기준 자식 노드 추가 (parentKey 없으면 루트에 추가) */
export function addNodeToTree<T>(
  nodes: PrimeTreeNode<T>[],
  newNode: PrimeTreeNode<T>,
  parentKey?: string,
): PrimeTreeNode<T>[] {
  if (!parentKey) return [...nodes, newNode];

  return nodes.map((n) => {
    if (n.key === parentKey) {
      return { ...n, children: n.children ? [...n.children, newNode] : [newNode] };
    }
    return {
      ...n,
      children: n.children ? addNodeToTree(n.children, newNode, parentKey) : [],
    };
  });
}

/** 재귀적으로 모든 노드의 개수를 셉니다. */
export function countTotalNodes<T>(nodes: PrimeTreeNode<T>[]): number {
  let count = nodes.length; // 현재 레벨의 노드 수
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      count += countTotalNodes(node.children); // 하위 노드 수 재귀 호출
    }
  }
  return count;
}

export function mapToPrimeTreeSelectNodes(nodes: PrimeTreeNode<any>[], labelField: string): any[] {
  return nodes.map((n) => ({
    key: n.key,
    label: n.data[labelField], // 동적 label 필드 (예: 'deptNm', 'menuNm')
    data: n.data,
    children: n.children ? mapToPrimeTreeSelectNodes(n.children, labelField) : [],
  }));
}
