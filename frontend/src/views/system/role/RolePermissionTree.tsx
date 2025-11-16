import { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { TreeTable, type TreeTableExpandedKeysType } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { Checkbox } from 'primereact/checkbox';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import api from 'src/api/axios';
import type { Role } from 'src/config/types/Role';
import type { Menu } from 'src/config/types/Menu';
import type { Action } from 'src/config/types/Action';
import type { PrimeTreeNode } from 'src/utils/treeUtils';
import { buildTreeFromFlat } from 'src/utils/treeUtils';

interface RolePermissionTreeProps {
  selectedRole: Role | null;
}

// [프론트 UI용] 권한 상태 (예: { "5": ["CREATE", "VIEW"] })
// (백엔드 맵 API와 형식이 동일해짐)
type PermissionState = Record<string, string[]>;

/**
 * [권한 관리] 페이지의 오른쪽 패널 (백엔드 API 연동 최종본)
 */
export default function RolePermissionTree({ selectedRole }: RolePermissionTreeProps) {
  const toast = useRef<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<TreeTableExpandedKeysType>({});

  // 1. 데이터 상태
  const [menuNodes, setMenuNodes] = useState<PrimeTreeNode<Menu>[]>([]);
  const [actionColumns, setActionColumns] = useState<Action[]>([]);

  // 2. 권한 선택 상태 (UI용)
  const [permissionState, setPermissionState] = useState<PermissionState>({});

  // 3. 역할(selectedRole)이 변경될 때마다 모든 데이터 새로고침
  useEffect(() => {
    if (selectedRole) {
      setLoading(true);
      setMenuNodes([]);
      setActionColumns([]);
      setPermissionState({});

      Promise.all([
        // 1. 메뉴 트리
        api.get('/system/menu'),
        // 2. 액션 컬럼
        api.get('/system/action'),
        // 3. [신규 API] 선택된 역할의 현재 권한 (Map 형식)
        api.get(`/system/role-permissions/map/${selectedRole.roleId}`),
      ])
        .then(([menuRes, actionRes, permissionRes]) => {
          // --- 1. 메뉴 설정 ---
          const tree = buildTreeFromFlat<Menu>(menuRes.data, 'menuId', 'parentMenuId');
          setMenuNodes(tree);

          // --- 2. 액션 설정 ---
          const activeActions = actionRes.data.filter((a: Action) => a.isActive);
          setActionColumns(activeActions);

          // --- 3. 권한 설정 (API가 맵을 직접 반환하므로 변환 불필요) ---
          setPermissionState(permissionRes.data);

          // (선택) 모든 메뉴 노드를 기본적으로 펼침
          const expandAll = (nodes: PrimeTreeNode<Menu>[]) => {
            let keys: TreeTableExpandedKeysType = {};
            for (const node of nodes) {
              if (node.children && node.children.length) {
                keys[node.key] = true;
                keys = { ...keys, ...expandAll(node.children) };
              }
            }
            return keys;
          };
          setExpandedKeys(expandAll(tree));
        })
        .catch((err) => {
          console.error('권한 데이터 로드 실패', err);
          toast.current?.show({
            severity: 'error',
            summary: '로드 실패',
            detail: '권한 정보를 불러오는 데 실패했습니다.',
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setMenuNodes([]);
      setActionColumns([]);
      setPermissionState({});
    }
  }, [selectedRole]);

  // 4. 체크박스 변경 핸들러 (로직 동일)
  const handlePermissionChange = (
    menuCd: string, // "5"
    actionCd: string, // "VIEW"
    isChecked: boolean | undefined | null,
  ) => {
    setPermissionState((prevState) => {
      const newState = { ...prevState };
      const menuPermissions = [...(newState[menuCd] || [])];

      if (isChecked) {
        if (!menuPermissions.includes(actionCd)) {
          menuPermissions.push(actionCd);
        }
      } else {
        const index = menuPermissions.indexOf(actionCd);
        if (index > -1) {
          menuPermissions.splice(index, 1);
        }
      }
      newState[menuCd] = menuPermissions;
      return newState;
    });
  };

  // 5. 저장 버튼 핸들러
  const handleSave = async () => {
    if (!selectedRole) return;
    setLoading(true);

    try {
      // [신규 API] PUT /system/role-permissions/map/:roleId 호출
      // 프론트엔드 상태(permissionState)를 변환 없이 그대로 전송
      await api.put(`/system/role-permissions/map/${selectedRole.roleId}`, permissionState);

      toast.current?.show({
        severity: 'success',
        summary: '저장 완료',
        detail: `[${selectedRole.roleNm}] 역할의 권한이 저장되었습니다.`,
      });
    } catch (err: any) {
      console.error('권한 저장 실패', err);
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: err.response?.data?.message || '권한을 저장하는 데 실패했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 6. 카드 헤더 (저장 버튼 포함)
  const cardHeader = (
    <div className="flex justify-content-between align-items-center">
      <span className="p-card-title">
        {selectedRole ? `권한 설정: ${selectedRole.roleNm}` : '권한 설정'}
      </span>
      {selectedRole && (
        <Button label="저장" icon="pi pi-check" onClick={handleSave} loading={loading} />
      )}
    </div>
  );

  // 7. 액션 컬럼(체크박스)의 Body 템플릿
  const actionColumnBody = (node: PrimeTreeNode<Menu>, action: Action) => {
    // if (node.children && node.children.length > 0) {
    //   return null;
    // }

    if (!node.data.menuPath) {
      return null;
    }

    const menuCd = node.data.menuCd;
    const actionCd = action.actionCd;

    const menuPermissions = permissionState[menuCd] || [];
    const isChecked = menuPermissions.includes(actionCd);

    // 메뉴가 비활성화(isActive: false)면 체크박스 비활성화
    const isMenuDisabled = !node.data.isActive;

    return (
      <Checkbox
        checked={isChecked}
        onChange={(e) => handlePermissionChange(menuCd, actionCd, e.checked)}
        disabled={isMenuDisabled}
      />
    );
  };

  // 8. 동적 액션 컬럼 생성
  const dynamicActionColumns = actionColumns.map((action) => (
    <Column
      key={action.actionCd}
      field={action.actionCd}
      header={action.actionNm}
      body={(node) => actionColumnBody(node, action)}
      style={{ width: '4rem', minWidth: '4rem', textAlign: 'center' }}
    />
  ));

  return (
    <>
      <Toast ref={toast} />
      {/* <Card title={cardHeader} className="card-flex-full"> */}
      <Card title={cardHeader} className="flex flex-column flex-grow-1">
        {loading && (
          <div className="text-center p-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        )}

        {!loading && !selectedRole && <p>왼쪽 목록에서 역할을 선택하세요.</p>}

        {!loading && selectedRole && menuNodes.length > 0 && (
          <div className="primereact-treetable-wrapper">
            <TreeTable
              value={menuNodes}
              expandedKeys={expandedKeys}
              onToggle={(e) => setExpandedKeys(e.value)}
              loading={loading}
              tableStyle={{ width: 'max-content', minWidth: '100%' }}
              className="p-treetable-sm"
            >
              <Column field="menuNm" header="메뉴" expander style={{ minWidth: '10rem' }} />

              <Column
                header="상태"
                body={(node: PrimeTreeNode<Menu>) =>
                  !node.data.isActive && <Tag severity="warning" value="비활성" />
                }
                style={{ minWidth: '3rem', textAlign: 'center' }}
              />

              {dynamicActionColumns}
            </TreeTable>
          </div>
        )}
      </Card>
    </>
  );
}
