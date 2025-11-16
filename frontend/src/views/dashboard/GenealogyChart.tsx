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
  };
  children: GenealogyNode[];
  label?: string;
}

// OrganizationChart의 노드 템플릿
const nodeTemplate = (node: OrganizationChartNodeData) => {
  if (!node) return null;
  const genealogyNode = node as GenealogyNode;
  const data = genealogyNode.data;

  return (
    <div className="p-1 border-round surface-border surface-card genealogy-node">
      <div className="font-bold text-base">{data.userNm}</div>
      <div className="text-color-secondary text-xs mb-1">({data.loginId})</div>
      <div className="text-xs p-tag p-tag-rounded p-tag-info">
        {data.position?.positionNm || '직급 없음'}
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
export default function GenealogyChart() {
  const [dashboardNodes, setDashboardNodes] = useState<GenealogyNode[]>([]);
  const [fullNodes, setFullNodes] = useState<GenealogyNode[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showFullGenealogy, setShowFullGenealogy] = useState(false);

  // 대시보드용 데이터 로드 (depth=1: 본인 + 1단계)
  const loadDashboardData = useCallback(() => {
    setLoadingDashboard(true);
    api
      .get('/system/users/me/genealogy', { params: { depth: 1 } }) // 👈 [수정] depth=1
      .then((res) => {
        setDashboardNodes(res.data);
      })
      .catch((err) => console.error('대시보드 계보도 데이터 로드 실패', err))
      .finally(() => setLoadingDashboard(false));
  }, []);

  // 전체 계보도 데이터 로드 (depth=10 또는 기본값)
  const loadFullGenealogyData = useCallback(() => {
    setLoadingFull(true);
    api
      .get('/system/users/me/genealogy', { params: { depth: 10 } }) // 👈 [수정] depth=10
      .then((res) => {
        setFullNodes(res.data);
      })
      .catch((err) => console.error('전체 계보도 데이터 로드 실패', err))
      .finally(() => setLoadingFull(false));
  }, []);

  useEffect(() => {
    loadDashboardData();
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

  // 대시보드용 카드 헤더
  const dashboardCardHeader = (
    <div className="flex justify-content-between align-items-center pt-3 px-3">
      <span className="p-card-title">계보도</span>
      <div className="flex gap-2">
        <Button
          label="전체 계보도 보기"
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
        header="전체 하위 추천 계보도"
        visible={showFullGenealogy}
        onHide={onHideFullGenealogy}
        maximizable
        modal
        className="genealogy-full-modal"
        style={{ width: '90vw', height: '90vh' }}
        contentStyle={{ height: 'calc(100% - 50px)', overflow: 'hidden' }}
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
