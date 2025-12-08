import { useRef, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { useForm, Controller } from 'react-hook-form';
import api from 'src/api/axios';

interface AdjustmentFormData {
  amount: number | null;
  reason: string;
}

interface AdjustmentAmountModalProps {
  visible: boolean;
  onHide: () => void;
  onSave: () => void;

  // [수정] 타겟 정보 (type에 따라 ID 필드가 달라짐)
  targetType: 'LEDGER' | 'PERFORMANCE';
  targetId: number | null;
  targetName?: string; // 모달 제목용 (홍길동 - 2024-10)
}

export default function AdjustmentAmountModal({
  visible,
  onHide,
  onSave,
  targetType,
  targetId,
  targetName,
}: AdjustmentAmountModalProps) {
  const toast = useRef<Toast | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormData>({
    defaultValues: { amount: null, reason: '' },
  });

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const onSubmit = async (data: AdjustmentFormData) => {
    if (!targetId || !data.amount) return;

    try {
      if (targetType === 'LEDGER') {
        // 1. 수당(Ledger) 조정 API 호출
        await api.post('/system/commission/manage/adjust', {
          ledgerId: targetId,
          adjustmentAmount: data.amount,
          reason: data.reason,
        });
      } else {
        // 2. 실적(Performance) 조정 API 호출
        await api.post('/system/commission/adjustment', {
          performanceId: targetId,
          amount: data.amount,
          reason: data.reason,
        });
      }

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

  return (
    <Dialog
      visible={visible}
      style={{ width: '30rem' }}
      header={`금액 조정 ${targetName ? `(${targetName})` : ''}`}
      modal
      onHide={onHide}
    >
      <Toast ref={toast} />
      <form onSubmit={handleSubmit(onSubmit)} className="formgrid grid pt-3">
        {/* ... (입력 폼 내용은 기존과 동일) ... */}
        <div className="field col-12">
          <label htmlFor="amount">조정 금액 *</label>
          <Controller
            name="amount"
            control={control}
            rules={{
              required: '금액을 입력하세요.',
              validate: (v) => (v != null && v !== 0) || '0원은 입력할 수 없습니다.',
            }}
            render={({ field }) => (
              <InputNumber
                id={field.name}
                value={field.value}
                onValueChange={(e) => field.onChange(e.value)}
                mode="currency"
                currency="KRW"
                locale="ko-KR"
                placeholder="-50000"
                className={errors.amount ? 'p-invalid w-full' : 'w-full'}
              />
            )}
          />
        </div>
        <div className="field col-12">
          <label htmlFor="reason">조정 사유 *</label>
          <Controller
            name="reason"
            control={control}
            rules={{ required: '사유를 입력하세요.' }}
            render={({ field }) => (
              <InputText {...field} className={errors.reason ? 'p-invalid w-full' : 'w-full'} />
            )}
          />
        </div>

        <div className="col-12 flex justify-content-end gap-2 mt-3">
          <Button label="취소" icon="pi pi-times" outlined onClick={onHide} type="button" />
          <Button label="저장" icon="pi pi-check" type="submit" loading={isSubmitting} />
        </div>
      </form>
    </Dialog>
  );
}
