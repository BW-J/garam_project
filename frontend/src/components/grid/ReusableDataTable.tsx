import { DataTable, type DataTableProps } from 'primereact/datatable';
import type {
  DataTableEditingRows,
  DataTableRowEditCompleteEvent,
  DataTableRowEditEvent,
  DataTableSelectionSingleChangeEvent,
  DataTableSelectionMultipleChangeEvent,
} from 'primereact/datatable';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import React from 'react';

type ReusableDataTableProps<TValue extends object> = DataTableProps<TValue[]> & {
  // DataTable 필수 Props
  value: TValue[];
  children?: React.ReactNode;
  dataKey: string;
  editMode?: 'row' | 'cell' | undefined;
  editingRows?: DataTableEditingRows | undefined;
  scrollHeight?: string;
  metaKeySelection?: boolean;
  selectionMode?: 'single' | 'multiple' | 'checkbox' | 'radiobutton';
  selection?: TValue | TValue[] | null;
  filterDisplay?: 'row' | 'menu';
  onSelectionChange?: (
    e: DataTableSelectionSingleChangeEvent<any> | DataTableSelectionMultipleChangeEvent<any>,
  ) => void;

  onRowEditComplete?: (e: DataTableRowEditCompleteEvent) => void;
  onRowEditChange?: (e: DataTableRowEditEvent) => void;

  // 래퍼 옵션
  usePagination?: boolean;
  useGridlines?: boolean;
  defaultRows?: number;
  loading?: boolean;
  useHeader?: boolean;
  useGlobalFilter?: boolean;
  globalFilterValue?: string;
  useAddRootButton?: boolean;
  onReload?: () => void;
  onAddRoot?: () => void;
  onGlobalFilterChange?: (value: string) => void;

  // Paginator (옵션)
  paginatorLeft?: React.ReactNode;
  paginatorRight?: React.ReactNode;
};

export const ReusableDataTable = <TValue extends object>({
  // DataTable Props
  value,
  children,
  dataKey,
  editMode,
  editingRows,
  scrollHeight,
  onRowEditComplete,
  onRowEditChange,

  selectionMode,
  selection,
  onSelectionChange,

  // 래퍼 옵션
  usePagination = false,
  useGridlines = false,
  defaultRows = 10,
  loading = false,
  useHeader = true,
  useGlobalFilter = false,
  globalFilterValue = '',
  metaKeySelection = true,
  onGlobalFilterChange,
  paginatorLeft,
  paginatorRight,
  filterDisplay,
  ...rest
}: ReusableDataTableProps<TValue>) => {
  // ... (paginatorProps, renderHeader 렌더링 함수는 동일)
  const paginatorProps = usePagination
    ? {
        paginator: true,
        rows: defaultRows,
        rowsPerPageOptions: [5, 10, 25, 50],
        paginatorTemplate:
          'RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
        currentPageReportTemplate: '{first} ~ {last} / 총 {totalRecords} 건',
        paginatorLeft: paginatorLeft,
        paginatorRight: paginatorRight,
        paginatorPosition: 'bottom',
      }
    : {};

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
              defaultValue={globalFilterValue}
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
    <div className="primereact-datatable-wrapper">
      <DataTable
        {...({
          value: value,
          dataKey: dataKey,
          editMode: editMode,
          editingRows: editingRows,
          onRowEditComplete: onRowEditComplete,
          onRowEditChange: onRowEditChange,
          className: 'p-datatable-sm',
          showGridlines: useGridlines,
          loading: loading,
          header: renderHeader(),
          globalFilter: globalFilterValue,
          filterDisplay: filterDisplay,
          ...paginatorProps,
          scrollable: true,
          scrollHeight: scrollHeight,
          selectionMode: selectionMode,
          selection: selection,
          onSelectionChange: onSelectionChange as any,
          metaKeySelection: metaKeySelection,
          ...rest,
        } as any)}
      >
        {children}
      </DataTable>
    </div>
  );
};
