import { InputText } from 'primereact/inputtext';
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown';
import type { PrimeTreeNode } from './treeUtils';
import type { ColumnEditorOptions, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { TreeSelect, type TreeSelectChangeEvent } from 'primereact/treeselect';
import type { TreeTableFilterMeta } from 'primereact/treetable';

export interface EditorOptions<T extends Record<string, any>> {
  node: PrimeTreeNode<T>;
  editingKey?: string;
  editingRowData?: T;
  field: keyof T;
  onEditDataChange: (field: keyof T, value: any) => void;
}

/** ------- treeTable용 템플릿 --------- */
/** 텍스트 에디터 */
export const textEditorTemplate = <T extends Record<string, any>>(opts: EditorOptions<T>) => {
  const { node, editingKey, editingRowData, field, onEditDataChange } = opts;

  if (editingKey === node.key) {
    return (
      <InputText
        value={editingRowData?.[field] ?? ''}
        type="text"
        onKeyDownCapture={(e) => {
          const input = e.currentTarget;
          if (e.key === 'Home') {
            input.setSelectionRange(0, 0);
            e.preventDefault();
            e.stopPropagation(); // 중요!!
          }
          if (e.key === 'End') {
            const len = input.value.length;
            input.setSelectionRange(len, len);
            e.preventDefault();
            e.stopPropagation(); // 중요!!
          }
        }}
        onChange={(e) => onEditDataChange(field, e.target.value)}
        style={{ width: '100%' }}
      />
    );
  }
  return node.data[field];
};

/** 숫자 에디터 */
export const numberEditorTemplate = <T extends Record<string, any>>(opts: EditorOptions<T>) => {
  const { node, editingKey, editingRowData, field, onEditDataChange } = opts;

  if (editingKey === node.key) {
    return (
      <InputText
        type="number"
        value={String(editingRowData?.[field] ?? 0)}
        onChange={(e) => onEditDataChange(field, e.target.valueAsNumber)}
        style={{ width: '100%' }}
      />
    );
  }
  return node.data[field];
};

/** 범용 Select 에디터 (boolean, enum 등 모두 처리 가능) */
export const selectEditorTemplate = <T extends Record<string, any>>(
  opts: EditorOptions<T> & {
    options: { label: string; value: any }[];
  },
) => {
  const { node, editingKey, editingRowData, field, onEditDataChange, options } = opts;
  const data = (editingKey === node.key ? editingRowData : node.data)!;
  if (editingKey === node.key) {
    return (
      <Dropdown
        value={data[field]}
        options={options}
        onChange={(e) => onEditDataChange(field, e.value)}
        style={{ width: '100%' }}
      />
    );
  }
  return options.find((o) => o.value === data[field])?.label ?? '';
};

/** Boolean 전용 템플릿 */
export const booleanDropdownEditorTemplate = <T extends Record<string, any>>(
  opts: EditorOptions<T>,
) =>
  selectEditorTemplate({
    ...opts,
    options: [
      { label: '사용', value: true },
      { label: '미사용', value: false },
    ],
  });

/** ------- treeTable용 템플릿 --------- */

/** ------- dataTable용 템플릿 --------- */
/** (DataTable) 텍스트 에디터 */
export const datatableTextEditor = (options: ColumnEditorOptions) => (
  <InputText
    type="text"
    value={options.value ?? ''}
    onChange={(e) => options.editorCallback!(e.target.value)}
    style={{ width: '100%' }}
  />
);

/** (DataTable) 숫자 에디터 */
export const datatableNumberEditor = (options: ColumnEditorOptions) => (
  <InputText
    type="number"
    value={String(options.value ?? 0)} // 👈 String()으로 감싸서 0이 표시되도록 함
    onChange={(e) => options.editorCallback!(e.target.valueAsNumber)}
    style={{ width: '100%' }}
  />
);

/** (DataTable) Boolean 에디터 (Dropdown) */
export const datatableBooleanEditor = (options: ColumnEditorOptions) => (
  <Dropdown
    value={options.value}
    options={[
      { label: '사용', value: true },
      { label: '미사용', value: false },
    ]}
    onChange={(e) => options.editorCallback!(e.value)}
    style={{ width: '100%' }}
    optionValue="value" // 👈 Dropdown이 객체 대신 값(true/false)을 반환하도록 보장
  />
);
/** ------- dataTable용 템플릿 --------- */

/**
 * boolean 전용 필터 템플릿 (DataTable 전용)
 * [요청대로 이전 상태로 복원]
 */
export const booleanFilterTemplate = (options: ColumnFilterElementTemplateOptions) => {
  return (
    <Dropdown
      value={options.value}
      options={[
        { label: '전체', value: null },
        { label: '사용', value: true },
        { label: '미사용', value: false },
      ]}
      //onChange={(e: DropdownChangeEvent) => options.filterCallback(e.value)}
      onChange={(e: DropdownChangeEvent) => options.filterApplyCallback(e.value)}
      optionValue="value"
      placeholder="전체"
      className="p-column-filter"
      style={{ minWidth: '8rem' }}
      showClear={options.value !== null && options.value !== undefined}
    />
  );
};

interface TreeTableBooleanFilterProps {
  field: string; // 'isActive' 등 필터 대상 필드명
  filters: TreeTableFilterMeta;
  onFilter: (filters: TreeTableFilterMeta) => void;
}

export const TreeTableBooleanFilter = ({
  field,
  filters,
  onFilter,
}: TreeTableBooleanFilterProps) => {
  // 훅에서 관리되는 전체 filters 객체에서 현재 필드(field)의 값({value, matchMode})을 찾음
  const currentValue = filters[field]?.value ?? null;

  const onChange = (e: DropdownChangeEvent) => {
    let nextFilters = { ...filters };

    if (
      e.value == null ||
      e.value === undefined ||
      (typeof e.value === 'object' && 'value' in e.value && e.value.value == null)
    ) {
      delete nextFilters[field];
    } else {
      nextFilters[field] = { value: e.value, matchMode: 'equals' };
    }

    onFilter(nextFilters);
  };

  return (
    <Dropdown
      value={currentValue}
      options={[
        { label: '전체', value: null },
        { label: '사용', value: true },
        { label: '미사용', value: false },
      ]}
      onChange={onChange}
      placeholder="전체"
      className="p-column-filter" // 스타일용 클래스
      style={{ minWidth: '8rem', width: '100%' }}
      showClear={currentValue !== null} // 값이 있을 때만 'X' (초기화) 버튼 표시
    />
  );
};

/**
 * TreeSelect 에디터 (표시/편집 모드 모두 처리)
 */
export const treeSelectEditorTemplate = <T extends Record<string, any>>(
  opts: EditorOptions<T> & {
    options: PrimeTreeNode<T>[];
    optionLabel: string;
    displayObjectField: keyof T;
    displayObjectLabelField: string;
  },
) => {
  const {
    node,
    editingKey,
    editingRowData,
    field,
    onEditDataChange,
    options,
    optionLabel,
    displayObjectField,
    displayObjectLabelField,
  } = opts;

  const mapToPrimeTreeNodes = (nodes: PrimeTreeNode<T>[]): any[] => {
    return nodes.map((n) => ({
      key: n.key,
      label: n.data[optionLabel],
      data: n.data,
      children: n.children ? mapToPrimeTreeNodes(n.children) : [],
    }));
  };
  const treeSelectOptions = mapToPrimeTreeNodes(options);

  if (editingKey === node.key) {
    const currentValue = editingRowData?.[field] ?? null;
    return (
      <TreeSelect
        value={currentValue}
        options={treeSelectOptions}
        onChange={(e: TreeSelectChangeEvent) => {
          const newValue = e.value === null || e.value === undefined ? null : Number(e.value);
          onEditDataChange(field, newValue);
        }}
        filter
        showClear
        placeholder="상위 항목 선택"
        style={{ width: '100%' }}
        panelStyle={{ width: 'max-content', minWidth: '20rem' }}
      />
    );
  }

  const data = node.data as any;
  const parentObject = data?.[displayObjectField];
  return parentObject?.[displayObjectLabelField] ?? ' (최상위)';
};
