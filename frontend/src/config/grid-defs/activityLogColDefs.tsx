import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Tooltip } from 'primereact/tooltip';
import type { ActivityLog } from 'src/config/types/Log';

// 툴팁 및 셀 내용 스타일링을 위한 헬퍼
const jsonBodyTemplate = (data: any) => {
  if (!data) return null;

  const jsonString = JSON.stringify(data);
  const truncated = jsonString.length > 50 ? `${jsonString.substring(0, 50)}...` : jsonString;

  const targetId = `json-tooltip-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <>
      {/* 1. 툴팁 컴포넌트 (페이지당 한 번만 렌더링되도록 body에 append) */}
      <Tooltip target={`.${targetId}`} position="top" autoHide={false}>
        <pre className="p-tooltip-pre">{JSON.stringify(data, null, 2)}</pre>
      </Tooltip>

      {/* 2. 실제 셀에 표시될 내용 (축약) */}
      <span className={`truncate-cell-content ${targetId}`}>{truncated}</span>
    </>
  );
};

// 날짜 포맷팅
const dateBody = (rowData: ActivityLog) => {
  return new Date(rowData.createdAt).toLocaleString('ko-KR');
};

// HTTP Status 태그
const statusBody = (rowData: ActivityLog) => {
  const status = rowData.resultStatus;
  if (!status) return null;

  let severity: 'success' | 'info' | 'warning' | 'danger' = 'info';
  if (status >= 200 && status < 300) severity = 'success';
  if (status >= 400 && status < 500) severity = 'warning';
  if (status >= 500) severity = 'danger';

  return <Tag severity={severity} value={status} />;
};

export const getActivityLogColumns = () => {
  return [
    <Column
      key="createdAt"
      field="createdAt"
      header="시간"
      body={dateBody}
      sortable
      style={{ minWidth: '10rem' }}
    />,
    <Column
      key="user.userNm"
      field="user.userNm"
      header="사용자"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="사용자 검색"
      style={{ minWidth: '6rem' }}
    />,
    <Column
      key="actionName"
      field="actionName"
      header="작업명"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="작업명 검색"
      style={{ minWidth: '8rem' }}
    />,
    <Column
      key="method"
      field="method"
      header="메서드"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
      style={{ width: '6rem' }}
    />,
    <Column
      key="resultStatus"
      field="resultStatus"
      header="상태"
      body={statusBody}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
      style={{ width: '6rem' }}
    />,
    <Column
      key="path"
      field="path"
      header="경로 (Path)"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '15rem' }}
    />,
    <Column
      key="params"
      field="params"
      header="요청 데이터"
      body={(rowData: ActivityLog) => jsonBodyTemplate(rowData.params)}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '15rem' }}
    />,
    <Column
      key="ipAddr"
      field="ipAddr"
      header="IP 주소"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
      style={{ minWidth: '8rem' }}
    />,
  ];
};
