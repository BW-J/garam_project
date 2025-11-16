import { Column } from 'primereact/column';
import { Tooltip } from 'primereact/tooltip';
import { Tag } from 'primereact/tag';
import type { AuditLog } from 'src/config/types/Log';
// 툴팁 및 셀 내용 스타일링을 위한 헬퍼 (JSON 표시)
const jsonBodyTemplate = (data: any) => {
  if (!data) return null;

  const jsonString = JSON.stringify(data);
  const truncated = jsonString.length > 50 ? `${jsonString.substring(0, 50)}...` : jsonString;

  const targetId = `json-tooltip-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <>
      <Tooltip target={`.${targetId}`} position="top" autoHide={false}>
        <pre className="p-tooltip-pre">{JSON.stringify(data, null, 2)}</pre>
      </Tooltip>
      <span className={`truncate-cell-content ${targetId}`}>{truncated}</span>
    </>
  );
};

// 날짜 포맷팅
const dateBody = (rowData: AuditLog) => {
  return new Date(rowData.createdAt).toLocaleString('ko-KR');
};

// Operation 태그
const operationBody = (rowData: AuditLog) => {
  const op = rowData.operation;
  let severity: 'success' | 'info' | 'danger' = 'info';
  if (op === 'INSERT') severity = 'success';
  if (op === 'DELETE') severity = 'danger';

  return <Tag severity={severity} value={op} />;
};

export const getAuditLogColumns = () => {
  return [
    <Column
      key="createdAt"
      field="createdAt"
      header="시간"
      body={dateBody}
      sortable
      style={{ minWidth: '12rem' }}
    />,
    <Column
      key="changedByUser.userNm"
      field="changedByUser.userNm"
      header="수행자"
      filter
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      sortable
      filterPlaceholder="수행자 검색"
      style={{ minWidth: '8rem' }}
    />,
    <Column
      key="operation"
      field="operation"
      header="작업"
      body={operationBody}
      style={{ width: '6rem', textAlign: 'center' }}
    />,
    <Column
      key="entityNm"
      field="entityNm"
      header="대상 엔티티"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      filterPlaceholder="엔티티 검색"
      style={{ minWidth: '10rem' }}
      headerClassName="hidden-on-mobile"
      bodyClassName="hidden-on-mobile"
      filterHeaderClassName="hidden-on-mobile"
    />,
    <Column
      key="entityKey"
      field="entityKey"
      header="엔티티 키"
      filter
      sortable
      showFilterMenu={false}
      showClearButton={false}
      filterMatchMode="contains"
      style={{ minWidth: '6rem' }}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
    <Column
      key="changes"
      field="changes"
      header="변경 내용"
      body={(rowData: AuditLog) => jsonBodyTemplate(rowData.changes)}
      style={{ minWidth: '20rem' }}
      headerClassName="hidden-on-tablet"
      bodyClassName="hidden-on-tablet"
      filterHeaderClassName="hidden-on-tablet"
    />,
  ];
};
