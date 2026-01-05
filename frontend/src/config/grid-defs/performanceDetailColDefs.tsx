import { Column, type ColumnEditorOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import type { PerformanceDetail } from 'src/config/types/Commission';

interface DetailProps {
  isEditable: boolean;
  onDelete: (detailId: number) => void;
}

const categoryMap: Record<string, string> = {
  BELOW_15: '15년납 미만 (50%)',
  ABOVE_15: '15년납 이상 (100%)',
  ADJUSTMENT: '관리자 조정',
};

export const getPerformanceDetailColumns = ({ isEditable, onDelete }: DetailProps) => {
  const numberEditor = (options: ColumnEditorOptions) => {
    return (
      <InputNumber
        value={options.value}
        onValueChange={(e) => options.editorCallback && options.editorCallback(e.value)}
        mode="currency"
        currency="KRW"
        locale="ko-KR"
        className="w-full"
        inputClassName="p-inputtext-sm text-right"
      />
    );
  };

  const currencyBody = (val: number) => Number(val || 0).toLocaleString('ko-KR');

  const columns = [
    <Column
      key="cat"
      field="category"
      header="구분"
      body={(r: PerformanceDetail) => categoryMap[r.category] || r.category}
      style={{ minWidth: '6rem' }}
    />,

    // 인라인 편집 컬럼들
    <Column
      key="prem"
      field="insurancePremium"
      header="보험료"
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right' }}
      body={(r: any) => currencyBody(r.insurancePremium)}
      editor={numberEditor}
    />,
    <Column
      key="with"
      field="withdrawal"
      header="철회"
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right' }}
      body={(r: any) => currencyBody(r.withdrawal)}
      editor={numberEditor}
    />,
    <Column
      key="canc"
      field="cancellation"
      header="해지"
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right' }}
      body={(r: any) => currencyBody(r.cancellation)}
      editor={numberEditor}
    />,
    <Column
      key="laps"
      field="lapse"
      header="실효"
      alignHeader={'right'}
      style={{ minWidth: '8rem', textAlign: 'right' }}
      body={(r: any) => currencyBody(r.lapse)}
      editor={numberEditor}
    />,

    <Column
      key="calc"
      field="calculatedAmount"
      header="반영금액"
      alignHeader={'right'}
      style={{ fontWeight: 'bold', textAlign: 'right' }}
      body={(r: PerformanceDetail) => Number(r.calculatedAmount).toLocaleString('ko-KR')}
    />,
    <Column key="note" field="note" header="비고" />,
  ];
  if (isEditable) {
    columns.push(
      <Column
        key="rowEditor"
        rowEditor
        header="수정"
        alignHeader="center"
        headerStyle={{ width: '5rem', minWidth: '5rem' }}
        bodyStyle={{ textAlign: 'center' }}
      />,
      <Column
        key="del"
        header="삭제"
        alignHeader="center"
        style={{ width: '5rem', textAlign: 'center' }}
        body={(r: PerformanceDetail) => {
          if (isEditable && r.category === 'ADJUSTMENT') {
            return (
              <Button
                icon="pi pi-trash"
                className="p-button-rounded p-button-danger p-button-text"
                onClick={() => onDelete(r.detailId)}
              />
            );
          }
          return null;
        }}
      />,
    );
  }
  return columns;
};
