import { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore, useAuthActions } from 'src/store/authStore';
import api from 'src/api/axios';
import { JSEncrypt } from 'jsencrypt';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { PasswordStatus } from 'src/common/constants/password-status';

// 비밀번호 검증 스키마
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다.')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        '영문 대/소문자, 숫자, 특수문자(@$!%*?&)를 포함해야 합니다.',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function ForcePasswordChangeModal() {
  const toast = useRef<Toast | null>(null);
  const passwordStatus = useAuthStore((state) => state.passwordStatus);
  const user = useAuthStore((state) => state.user);

  const { setPasswordStatus, logout } = useAuthActions();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extending, setExtending] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const visible = passwordStatus !== PasswordStatus.OK;

  useEffect(() => {
    if (visible && user && !publicKey) {
      api
        .get('/auth/public-key')
        .then((res) => setPublicKey(res.data.publicKey))
        // 혹시 API 실패 시 계속 재시도하는 것을 막기 위해 에러 처리도 추가하면 좋음
        .catch((err) => console.error('공개키 로드 실패', err));
    }
  }, [visible, publicKey, user]);

  const handleExtend = async () => {
    setExtending(true);
    try {
      await api.post('/system/users/me/extend-password');
      toast.current?.show({
        severity: 'success',
        summary: '연장 완료',
        detail: '비밀번호 유효기간이 90일 연장되었습니다.',
      });
      setPasswordStatus(PasswordStatus.OK); // 모달 닫기
    } catch (error: any) {
      toast.current?.show({
        severity: 'error',
        summary: '연장 실패',
        detail: error.response?.data?.message || '오류가 발생했습니다.',
      });
    } finally {
      setExtending(false);
    }
  };

  const onSubmit = async (data: PasswordForm) => {
    if (!user || !publicKey) return;
    setLoading(true);
    try {
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(publicKey);
      const encryptedPassword = encrypt.encrypt(data.password);

      if (!encryptedPassword) throw new Error('Encryption failed');

      // 내 정보 수정 API 호출
      await api.patch(`/system/users/me/${user.userId}`, {
        password: encryptedPassword,
      });

      toast.current?.show({
        severity: 'success',
        summary: '성공',
        detail: '비밀번호가 변경되었습니다.',
      });
      setPasswordStatus(PasswordStatus.OK); // 모달 닫기
      reset();
    } catch (error: any) {
      console.error('비밀번호 변경 실패', error);
      toast.current?.show({
        severity: 'error',
        summary: '변경 실패',
        detail: error.response?.data?.message || '오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        visible={true}
        closable={false}
        header="비밀번호 변경 필요"
        modal
        style={{ width: '500px' }}
        breakpoints={{
          '1440px': '50vw',
          '960px': '75vw',
          '640px': '90vw',
          '480px': '95vw',
        }}
        onHide={() => {}} // 빈 함수 (배경 클릭 등으로 닫히지 않게)
      >
        <div className="mb-4 line-height-3">
          {passwordStatus === PasswordStatus.MUST_CHANGE ? (
            <p className="text-red-500 font-bold">
              최초 로그인 또는 관리자에 의해 비밀번호가 초기화되었습니다.
              <br />
              안전을 위해 새로운 비밀번호로 변경해주세요.
            </p>
          ) : (
            <p>
              비밀번호 변경 주기가 도래했습니다.
              <br />
              지금 변경하시거나, 기존 비밀번호를 90일 더 사용하실 수 있습니다.
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-column gap-3">
          <div className="field">
            <span className="p-float-label">
              <Controller
                name="password"
                control={control}
                render={({ field, fieldState }) => (
                  <Password
                    id={field.name}
                    {...field}
                    toggleMask
                    feedback={false}
                    className={fieldState.invalid ? 'p-invalid w-full' : 'w-full'}
                    inputClassName="w-full"
                  />
                )}
              />
              <label htmlFor="password">새 비밀번호</label>
            </span>
            {errors.password && <small className="p-error">{errors.password.message}</small>}
          </div>

          <div className="field">
            <span className="p-float-label">
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field, fieldState }) => (
                  <Password
                    id={field.name}
                    {...field}
                    toggleMask
                    feedback={false}
                    className={fieldState.invalid ? 'p-invalid w-full' : 'w-full'}
                    inputClassName="w-full"
                  />
                )}
              />
              <label htmlFor="confirmPassword">새 비밀번호 확인</label>
            </span>
            {errors.confirmPassword && (
              <small className="p-error">{errors.confirmPassword.message}</small>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-content-between mt-4">
            <Button
              label="로그아웃"
              icon="pi pi-power-off"
              className="p-button-secondary p-button-text"
              onClick={() => {
                logout();
                window.location.href = '#/login';
              }}
              type="button"
            />
            <div className="flex gap-2">
              {passwordStatus === PasswordStatus.EXPIRED && (
                <Button
                  label="90일 연장"
                  icon="pi pi-calendar-plus"
                  className="p-button-outlined p-button-info"
                  onClick={handleExtend}
                  loading={extending}
                  type="button"
                />
              )}
              <Button label="변경하기" icon="pi pi-check" type="submit" loading={loading} />
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
