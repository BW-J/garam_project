import { useEffect, useRef, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import api from 'src/api/axios';
import { Calendar } from 'primereact/calendar'; // 👈 [신규]
import { ProgressSpinner } from 'primereact/progressspinner'; // 👈 [신규]

// React Hook Form 및 Zod
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileFormSchema, type ProfileFormData } from 'src/config/schemas/profileFormSchema';

// JSEncrypt 및 AuthStore
import { JSEncrypt } from 'jsencrypt';
import { useAuthActions, type UserState } from 'src/store/authStore'; // 👈 [수정] UserState 임포트
import { useNavigate } from 'react-router-dom';
import type { User } from 'src/config/types/User'; // 👈 [신규] Full User 타입 임포트

/**
 * 개인정보 수정 페이지
 */
export default function ProfilePage() {
  const toast = useRef<Toast | null>(null);
  const navigate = useNavigate();
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // 👇 [신규] 스토어 유저가 아닌, API로 받아온 Full User 정보를 담을 State
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true); // 👈 [신규] 페이지 로딩 State

  // 1. AuthStore에서 업데이트 액션만 가져오기
  const { updateUserInfo } = useAuthActions();

  // 2. React Hook Form 훅 초기화 (변경 없음)
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  // 3. [수정] 스토어가 아닌, API로 직접 유저 정보를 로드하고 폼을 리셋
  useEffect(() => {
    setPageLoading(true);
    api
      .get('/system/users/me') // 👈 [수정] '/me' 엔드포인트에서 Full User 정보 조회
      .then((res) => {
        const user: User = res.data; // 👈 API 응답 (Full User)
        setFullUser(user); // 👈 [신규] 읽기전용 필드를 위해 Full User 저장

        // 폼 데이터 채우기 (profileFormSchema에 정의된 필드만)
        reset({
          userId: user.userId,
          userNm: user.userNm,
          email: user.email || '',
          cellPhone: user.cellPhone || '',
          address: user.address || '', // 👈 [신규]
          password: '', // 비밀번호 필드는 항상 비워둠
        });

        // 공개키 로드 (UserFormModal과 동일)
        if (!publicKey) {
          api
            .get('/auth/public-key')
            .then((res) => setPublicKey(res.data.publicKey))
            .catch((err) => console.error('공개키 로드 실패', err));
        }
      })
      .catch((err) => {
        console.error('사용자 정보 로드 실패', err);
        toast.current?.show({ severity: 'error', summary: '로드 실패' });
      })
      .finally(() => {
        setPageLoading(false);
      });
  }, [reset, publicKey]); // 👈 의존성 수정

  // 4. 저장 (Submit) 핸들러 (변경 없음)
  const onSubmit = async (data: ProfileFormData) => {
    try {
      const payload: Partial<ProfileFormData> = { ...data };

      // ... (비밀번호 암호화 로직은 기존과 동일) ...
      if (payload.password && payload.password.length > 0) {
        if (!publicKey) {
          toast.current?.show({
            severity: 'error',
            summary: '오류',
            detail: '암호화 키 로드 실패.',
          });
          return;
        }
        const encrypt = new JSEncrypt();
        encrypt.setPublicKey(publicKey);
        const encryptedPassword = encrypt.encrypt(payload.password);

        if (!encryptedPassword) {
          toast.current?.show({
            severity: 'error',
            summary: '오류',
            detail: '비밀번호 암호화 실패.',
          });
          return;
        }
        payload.password = encryptedPassword;
      } else {
        delete payload.password; // 비밀번호 변경 안 함
      }

      // 🚨 [수정] API 호출 경로 (백엔드 user.controller.ts의 @Patch('me/:userId')와 일치시킴)
      const response = await api.patch(`/system/users/me/${payload.userId}`, payload);

      // ... (성공 토스트, AuthStore 업데이트, 네비게이트 로직은 기존과 동일) ...
      toast.current?.show({
        severity: 'success',
        summary: '성공',
        detail: '정보가 수정되었습니다.',
      });
      updateUserInfo(response.data as UserState);
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      // ... (에러 처리 로직은 기존과 동일) ...
      console.error('저장 실패', error);
      const detailMessage = error.response?.data?.message || '오류가 발생했습니다.';
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: Array.isArray(detailMessage) ? detailMessage[0] : detailMessage,
      });
    }
  };

  if (pageLoading || !fullUser) {
    // 👈 [수정]
    return <ProgressSpinner style={{ width: '50px', height: '50px' }} />;
  }

  // 5. 렌더링 (읽기전용 / 수정가능 필드 분리)
  return (
    <>
      <Toast ref={toast} />
      <div className="grid justify-content-center">
        <div className="col-12 md:col-8 lg:col-6">
          <Card title="개인정보 수정">
            <div className="p-fluid formgrid grid">
              {/* --- 1. 수정 불가 필드 (fullUser State에서 값 표시) --- */}
              <div className="field col-12">
                <label htmlFor="loginId">로그인 ID</label>
                <InputText id="loginId" value={fullUser.loginId} disabled />
              </div>

              <div className="field col-12">
                <label htmlFor="userNm">사용자명</label>
                <InputText id="userNm" value={fullUser.userNm} disabled />
              </div>

              <div className="field col-12 md:col-6">
                <label htmlFor="dept">부서</label>
                <InputText id="dept" value={fullUser.department?.deptNm || '-'} disabled />
              </div>

              <div className="field col-12 md:col-6">
                <label htmlFor="pos">직급</label>
                <InputText id="pos" value={fullUser.position?.positionNm || '-'} disabled />
              </div>

              <div className="field col-12">
                <label htmlFor="birthDate">생년월일</label>
                <Calendar
                  id="birthDate"
                  value={fullUser.birthDate ? new Date(fullUser.birthDate) : null}
                  dateFormat="yy-mm-dd"
                  disabled
                />
              </div>

              {/* --- 2. 수정 가능 필드 (React Hook Form Controller) --- */}

              {/* --- 이메일 --- */}
              <div className="field col-12">
                <label htmlFor="email">이메일</label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <InputText
                      id={field.name}
                      type="email"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className={classNames({ 'p-invalid': fieldState.error })}
                    />
                  )}
                />
                {errors.email && <small className="p-error">{errors.email.message}</small>}
              </div>

              {/* --- 핸드폰 번호 --- */}
              <div className="field col-12">
                <label htmlFor="cellPhone">핸드폰 번호</label>
                <Controller
                  name="cellPhone"
                  control={control}
                  render={({ field, fieldState }) => (
                    <InputText
                      id={field.name}
                      type="tel"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className={classNames({ 'p-invalid': fieldState.error })}
                    />
                  )}
                />
                {errors.cellPhone && <small className="p-error">{errors.cellPhone.message}</small>}
              </div>

              {/* --- [신규] 주소 --- */}
              <div className="field col-12">
                <label htmlFor="address">주소</label>
                <Controller
                  name="address"
                  control={control}
                  render={({ field, fieldState }) => (
                    <InputText
                      id={field.name}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className={classNames({ 'p-invalid': fieldState.error })}
                    />
                  )}
                />
                {errors.address && <small className="p-error">{errors.address.message}</small>}
              </div>

              {/* --- 비밀번호 --- */}
              <div className="field col-12">
                <label htmlFor="password">새 비밀번호 (변경 시에만 입력)</label>
                <Controller
                  name="password"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Password
                      id={field.name}
                      value={field.value || ''}
                      onChange={field.onChange}
                      feedback={false}
                      toggleMask
                      placeholder="8자 이상 입력"
                      className={classNames({ 'p-invalid': fieldState.error })}
                    />
                  )}
                />
                {errors.password && <small className="p-error">{errors.password.message}</small>}
              </div>

              {/* --- 저장 버튼 --- */}
              <div className="col-12 flex justify-content-end mt-4">
                <Button
                  label="저장"
                  icon="pi pi-check"
                  onClick={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  disabled={!isDirty || isSubmitting}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
