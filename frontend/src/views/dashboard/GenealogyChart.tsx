import { useState, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Dialog } from 'primereact/dialog';
import { OrganizationChart, type OrganizationChartNodeData } from 'primereact/organizationchart';
import api from 'src/api/axios';

interface GenealogyNode {
  key: string;
  data: {
    userId: number;
    userNm: string;
    loginId: string;
    depth: number;
    position?: { positionNm: string } | null;
    lastMonthPerf?: number; // [추가]
    deletedAt?: Date;
  };
  children: GenealogyNode[];
  label?: string;
}

interface GenealogyChartProps {
  targetUserId?: number; // 이 값이 있으면 해당 유저 조회, 없으면 'me' 조회
  title?: string; // 카드 제목 커스텀
  viewMode?: 'WIDGET' | 'FULL';
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
};

// OrganizationChart의 노드 템플릿
const nodeTemplate = (node: OrganizationChartNodeData) => {
  if (!node) return null;
  const genealogyNode = node as GenealogyNode;
  const data = genealogyNode.data;
  const perf = data.lastMonthPerf || 0;
  const nodeId = `json-node-${Math.random().toString(36).substring(2, 9)}`;
  const isDeleted = !!data.deletedAt;

  const bgColor = perf > 0 ? '#E3F2FD' : perf < 0 ? '#FFE6E9' : '#FAFAFA';

  // --- 중요: 렌더링 후 바깥 박스에 색상 적용 ---
  setTimeout(() => {
    const el = document.querySelector(`[data-nodekey="${nodeId}"]`);
    if (el) {
      const wrapper = el.closest('.p-organizationchart-node-content') as HTMLElement;
      if (wrapper) {
        wrapper.style.backgroundColor = bgColor;
        // wrapper.style.border = '1px solid #ddd';
        wrapper.style.borderRadius = '12px';
        // wrapper.style.padding = '12px';
        if (isDeleted) {
          wrapper.style.opacity = '0.6'; // 반투명
          wrapper.style.filter = 'grayscale(100%)'; // 흑백 처리
        } else {
          wrapper.style.opacity = '1';
          wrapper.style.filter = 'none';
        }
      }
    }
  });

  return (
    <div data-nodekey={nodeId} style={{ cursor: isDeleted ? 'default' : 'pointer' }}>
      <div
        className="font-bold text-base"
        style={{
          textDecoration: isDeleted ? 'line-through' : 'none',
          color: isDeleted ? '#666' : 'inherit',
        }}
      >
        {data.userNm}
        {isDeleted && <span className="text-red-500 ml-1 font-normal">(퇴사)</span>}
      </div>
      <div className="text-color-secondary text-xs mb-2">({data.loginId})</div>

      <div className="flex flex-column gap-1 align-items-center">
        <div className="text-xs p-tag p-tag-rounded p-tag-info">
          {data.position?.positionNm || '직급없음'}
        </div>

        {/* [추가] 전월 실적 표시 */}
        <div>{formatCurrency(perf)}</div>
      </div>
      {/* "나"(depth 0)일 때는 depth 표시 안 함 */}
      {data.depth > 0 && (
        <div className="text-xs text-color-secondary mt-1">Depth: {data.depth}</div>
      )}
    </div>
  );
};

/**
 * 하위 추천 계보도 표시 컴포넌트
 * 대시보드용 (depth 0, 1) 및 모달용 (전체 depth)
 */
export default function GenealogyChart({
  targetUserId,
  title = '계보도',
  viewMode = 'WIDGET',
}: GenealogyChartProps) {
  const [dashboardNodes, setDashboardNodes] = useState<GenealogyNode[]>([]);
  const [fullNodes, setFullNodes] = useState<GenealogyNode[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showFullGenealogy, setShowFullGenealogy] = useState(false);

  const getApiUrl = () => {
    return targetUserId ? `/system/users/${targetUserId}/genealogy` : '/system/users/me/genealogy';
  };
  // 대시보드용 데이터 로드 (depth=1: 본인 + 1단계)
  const loadDashboardData = useCallback(() => {
    setLoadingDashboard(true);
    api
      .get(getApiUrl(), { params: { depth: 1 } })
      .then((res) => {
        setDashboardNodes(res.data);
      })
      .catch((err) => console.error('대시보드 계보도 데이터 로드 실패', err))
      .finally(() => setLoadingDashboard(false));
  }, [targetUserId]);

  // 전체 계보도 데이터 로드 (depth=10 또는 기본값)
  const loadFullGenealogyData = useCallback(() => {
    setLoadingFull(true);
    api
      .get(getApiUrl(), { params: { depth: 10 } })
      .then((res) => {
        setFullNodes(res.data);
      })
      .catch((err) => console.error('전체 계보도 데이터 로드 실패', err))
      .finally(() => setLoadingFull(false));
  }, [targetUserId]);

  useEffect(() => {
    if (viewMode === 'FULL') {
      loadFullGenealogyData(); // 전체 데이터 즉시 로드
    } else {
      loadDashboardData(); // 요약 데이터 로드
      setFullNodes([]);
    }
  }, [loadDashboardData]);

  // '전체 계보도 보기' 버튼 클릭 핸들러
  const onShowFullGenealogy = () => {
    setShowFullGenealogy(true);
    if (fullNodes.length === 0) {
      loadFullGenealogyData();
    }
  };

  const onHideFullGenealogy = () => {
    setShowFullGenealogy(false);
  };

  if (viewMode === 'FULL') {
    return (
      <div className="h-full w-full flex flex-column">
        {/* 메인 차트 영역 */}
        <div className="flex-grow-1 overflow-auto p-3" style={{ minHeight: '100%' }}>
          {loadingFull && (
            <div className="flex justify-content-center align-items-center h-full">
              <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
            </div>
          )}
          {!loadingFull && fullNodes.length === 0 && (
            <div className="text-center p-5">하위 조직 정보가 없습니다.</div>
          )}
          {!loadingFull && fullNodes.length > 0 && (
            <div className="primereact-orgchart-wrapper-full">
              <OrganizationChart
                value={fullNodes}
                nodeTemplate={nodeTemplate}
                selectionMode="single"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 대시보드용 카드 헤더
  const dashboardCardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">{title}</span>
      <div className="flex gap-2">
        <Button
          label="전체 보기"
          icon="pi pi-sitemap"
          onClick={onShowFullGenealogy}
          className="p-button-sm p-button-secondary"
          outlined
        />
        <Button
          icon="pi pi-refresh"
          onClick={loadDashboardData}
          className="p-button-sm p-button-secondary"
          outlined
        />
      </div>
    </div>
  );

  return (
    <Card header={dashboardCardHeader} className="card-flex-full genealogy-dashboard-card">
      {/* 대시보드에 표시될 1단계 계보도 */}
      {loadingDashboard && (
        <div className="text-center p-4">
          <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
        </div>
      )}
      {!loadingDashboard && dashboardNodes.length === 0 && (
        <div className="text-center p-4">하위 추천 사용자가 없습니다.</div>
      )}
      {!loadingDashboard && dashboardNodes.length > 0 && (
        <div className="primereact-orgchart-wrapper-small">
          <OrganizationChart
            value={dashboardNodes}
            nodeTemplate={nodeTemplate}
            selectionMode="single"
          />
        </div>
      )}

      {/* 전체 계보도를 표시할 모달 */}
      <Dialog
        header={`${title} - 전체보기`}
        visible={showFullGenealogy}
        onHide={onHideFullGenealogy}
        maximizable
        modal
        className="genealogy-full-modal"
        style={{ width: '90vw', height: '90vh' }}
        contentStyle={{ height: 'calc(100% - 50px)', overflow: 'hidden' }}
        dismissableMask
      >
        {loadingFull && (
          <div className="text-center p-4 flex align-items-center justify-content-center h-full">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
          </div>
        )}
        {!loadingFull && fullNodes.length === 0 && (
          <div className="text-center p-4">하위 추천 사용자가 없습니다.</div>
        )}
        {!loadingFull && fullNodes.length > 0 && (
          <div className="primereact-orgchart-wrapper-full">
            <OrganizationChart
              value={fullNodes}
              nodeTemplate={nodeTemplate}
              selectionMode="single"
            />
          </div>
        )}
      </Dialog>
    </Card>
  );
}
