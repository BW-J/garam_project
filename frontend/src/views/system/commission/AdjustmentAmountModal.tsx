import { useRef, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { useForm, Controller } from 'react-hook-form';
import api from 'src/api/axios';
import type { CommissionSummary } from 'src/config/types/Commission';

interface AdjustmentAmountFormData {
  adjustmentAmount: number | null;
  reason: string;
}

interface AdjustmentAmountModalProps {
  visible: boolean;
  onHide: () => void;
  onSave: () => void;
  ledgerData: CommissionSummary | null; // 👈 조정 대상이 되는 요약본
}

export default function AdjustmentAmountModal({
  visible,
  onHide,
  onSave,
  ledgerData,
}: AdjustmentAmountModalProps) {
  const toast = useRef<Toast | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentAmountFormData>({
    defaultValues: {
      adjustmentAmount: null,
      reason: '',
    },
  });

  useEffect(() => {
    if (!visible) {
      reset(); // 모달 닫힐 때 폼 초기화
    }
  }, [visible, reset]);

  const onSubmit = async (data: AdjustmentAmountFormData) => {
    if (!ledgerData) return;

    try {
      await api.post('/system/commission/manage/adjust', {
        ledgerId: ledgerData.ledgerId, // 👈 [핵심] 요약본 ID 전달
        adjustmentAmount: data.adjustmentAmount,
        reason: data.reason,
      });
      toast.current?.show({ severity: 'success', summary: '조정 완료' });
      onSave();
      onHide();
    } catch (err: any) {
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: err.response?.data?.message || '오류 발생',
      });
    }
  };

  const dialogFooter = (
    <>
      <Button label="취소" icon="pi pi-times" outlined onClick={onHide} />
      <Button
        label="조정 저장"
        icon="pi pi-check"
        onClick={handleSubmit(onSubmit)}
        loading={isSubmitting}
      />
    </>
  );

  const header = ledgerData
    ? `[${ledgerData.userNm} - ${ledgerData.yearMonth}] 금액 조정`
    : '금액 조정';

  return (
    <Dialog
      visible={visible}
      style={{ width: '30rem' }}
      header={header}
      modal
      footer={dialogFooter}
      onHide={onHide}
    >
      <Toast ref={toast} />
      <div className="formgrid grid pt-3">
        {/* 조정 금액 */}
        <div className="field col-12">
          <label htmlFor="adjustmentAmount">조정 금액 * &nbsp; </label>
          <Controller
            name="adjustmentAmount"
            control={control}
            rules={{
              required: '조정 금액을 입력하세요.',
              validate: (v) => (v != null && v !== 0) || '0원은 입력할 수 없습니다.',
            }}
            render={({ field }) => (
              <InputNumber
                id={field.name}
                value={field.value}
                onValueChange={(e) => field.onChange(e.value)}
                mode="decimal"
                placeholder="예: 100000 (추가) 또는 -50000 (차감)"
                className={errors.adjustmentAmount ? 'p-invalid' : ''}
              />
            )}
          />
          {errors.adjustmentAmount && (
            <small className="p-error">{errors.adjustmentAmount.message}</small>
          )}
        </div>

        {/* 조정 사유 */}
        <div className="field col-12">
          <label htmlFor="reason">조정 사유 * &nbsp;</label>
          <Controller
            name="reason"
            control={control}
            rules={{ required: '조정 사유를 입력하세요.' }}
            render={({ field }) => (
              <InputText
                id={field.name}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder="조정 사유 입력 (예: 이벤트 추가 지급)"
                className={errors.reason ? 'p-invalid' : ''}
              />
            )}
          />
          {errors.reason && <small className="p-error">{errors.reason.message}</small>}
        </div>
      </div>
    </Dialog>
  );
}
