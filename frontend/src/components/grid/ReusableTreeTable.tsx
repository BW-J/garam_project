import { TreeTable } from 'primereact/treetable';
import type { TreeTableProps, TreeTableFilterMeta } from 'primereact/treetable';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';

/**
 * ReusableTreeTable 컴포넌트의 Props
 */
interface ReusableTreeTableProps
  extends Omit<
    TreeTableProps,
    | 'paginator'
    | 'rows'
    | 'rowsPerPageOptions'
    | 'paginatorTemplate'
    | 'currentPageReportTemplate'
    | 'showGridlines'
    | 'className'
    | 'header'
    | 'filters' // [수정] Omit
    | 'onFilter' // [수정] Omit
  > {
  // --- 래퍼 옵션 ---
  usePagination?: boolean;
  useGridlines?: boolean;
  defaultRows?: number;
  loading?: boolean;
  totalNodeCount?: number;

  // --- 헤더 옵션 ---
  useHeader?: boolean;
  useGlobalFilter?: boolean;
  globalFilterValue?: string;
  useAddRootButton?: boolean;
  editingKey?: string;
  sortable?: boolean;
  filters: TreeTableFilterMeta; // [수정] 훅에서 받음
  scrollHeight?: string;

  // --- 헤더 핸들러 ---
  onReload?: () => void;
  onAddRoot?: () => void;
  onGlobalFilterChange?: (value: string) => void;
  onFilter: (filters: TreeTableFilterMeta) => void; // [수정] 훅에서 받음
}

/**
 * 앱 전역에서 공통으로 사용할 PrimeReact TreeTable 래퍼 컴포넌트
 */
export const ReusableTreeTable = ({
  // 래퍼 옵션
  usePagination = false,
  useGridlines = false,
  defaultRows = 10,
  loading = false,
  totalNodeCount,
  scrollHeight,

  // 헤더 옵션
  useHeader = false,
  useGlobalFilter = false,
  globalFilterValue = '',
  useAddRootButton = false,
  editingKey = '',
  sortable = true,
  filters, // [수정] 받음

  // 핸들러
  onReload,
  onAddRoot,
  onGlobalFilterChange,
  onFilter, // [수정] 받음

  // TreeTable 원본 Props
  paginatorLeft,
  paginatorRight,

  children,
  ...rest
}: ReusableTreeTableProps) => {
  const rootCount = (rest.value || []).length;
  const showTotal = totalNodeCount && totalNodeCount > rootCount;

  const reportTemplate = showTotal
    ? `{first} ~ {last} / 총 ${totalNodeCount} 건`
    : `{first} ~ {last} / 총 {totalRecords} 건`;

  // --- 페이지네이션 공통 속성 ---
  const paginatorProps = usePagination
    ? {
        paginator: true,
        rows: defaultRows,
        rowsPerPageOptions: [5, 10, 25, 50],
        paginatorTemplate:
          'RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
        currentPageReportTemplate: reportTemplate,
        paginatorLeft: paginatorLeft,
        paginatorRight: paginatorRight,
      }
    : {};

  // --- 헤더 템플릿 생성 ---
  const renderHeader = () => {
    if (!useHeader) return undefined;

    return (
      <div className="flex justify-content-between align-items-center flex-wrap gap-2 p-2">
        <div className="flex gap-2 align-items-center"></div>

        {useGlobalFilter && onGlobalFilterChange && (
          <IconField iconPosition="left">
            <InputIcon className="pi pi-search" />
            <InputText
              type="search"
              onInput={(e) => onGlobalFilterChange((e.target as HTMLInputElement).value)}
              placeholder="전체 검색"
              className="w-full"
            />
          </IconField>
        )}
      </div>
    );
  };

  return (
    <div className="primereact-treetable-wrapper">
      <TreeTable
        tableStyle={{ width: 'max-content', minWidth: '100%' }}
        className="p-treetable-sm"
        rowClassName={(node: any) => ({
          'editing-row': editingKey === node.key,
          'leaf-row': !node.children?.length,
        })}
        loading={loading}
        header={renderHeader()}
        globalFilter={globalFilterValue}
        {...paginatorProps}
        {...rest}
        filters={filters}
        onFilter={(e) => onFilter(e.filters as unknown as TreeTableFilterMeta)}
        // scrollable={true}
        //scrollHeight={scrollHeight}
      >
        {children}
      </TreeTable>
    </div>
  );
};
