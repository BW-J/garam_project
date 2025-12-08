import { useEffect, useRef, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import api from 'src/api/axios';
import { Calendar } from 'primereact/calendar';
import { ProgressSpinner } from 'primereact/progressspinner';

// React Hook Form 및 Zod
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileFormSchema, type ProfileFormData } from 'src/config/schemas/profileFormSchema';

// JSEncrypt 및 AuthStore
import { JSEncrypt } from 'jsencrypt';
import { useAuthActions, type UserState } from 'src/store/authStore';
import { useNavigate } from 'react-router-dom';
import type { User } from 'src/config/types/User';
import { Fieldset } from 'primereact/fieldset';
import AddressSearchDialog from 'src/components/common/AddressSearchDialog';

/**
 * 개인정보 수정 페이지
 */
export default function ProfilePage() {
  const toast = useRef<Toast | null>(null);
  const navigate = useNavigate();
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const [fullUser, setFullUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [bankOptions, setBankOptions] = useState<{ label: string; value: string }[]>([]);
  const [showAddressSearch, setShowAddressSearch] = useState(false);

  // 1. AuthStore에서 업데이트 액션만 가져오기
  const { updateUserInfo } = useAuthActions();

  // 2. React Hook Form 훅 초기화 (변경 없음)
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  // 3. [수정] 스토어가 아닌, API로 직접 유저 정보를 로드하고 폼을 리셋
  useEffect(() => {
    setPageLoading(true);
    api
      .get('/system/users/me')
      .then((res) => {
        const user: User = res.data;
        setFullUser(user);

        // 폼 데이터 채우기 (profileFormSchema에 정의된 필드만)
        reset({
          userId: user.userId,
          userNm: user.userNm,
          email: user.email || '',
          cellPhone: user.cellPhone || '',
          address: user.address || '',
          password: '', // 비밀번호 필드는 항상 비워둠
          zipCode: user.zipCode || '',
          addressDetail: user.addressDetail || '',
        });

        api.get('/system/bank').then((res) => {
          const options = res.data.map((b: any) => ({
            label: b.bankName,
            value: b.bankCode,
          }));
          setBankOptions(options);
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
  }, [reset, publicKey]);

  const getBankName = (bankCode: string): string | null => {
    const find = bankOptions.find((b) => b.value === bankCode);
    return find ? find.label : null;
  };

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

      const response = await api.patch(`/system/users/me/${payload.userId}`, payload);

      // ... (성공 토스트, AuthStore 업데이트, 네비게이트 로직은 기존과 동일) ...
      toast.current?.show({
        severity: 'success',
        summary: '성공',
        detail: '정보가 수정되었습니다.',
      });
      updateUserInfo(response.data as UserState);
      setTimeout(() => navigate('/'), 1500);
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
    return <ProgressSpinner style={{ width: '50px', height: '50px' }} />;
  }

  const handleAddressComplete = (data: { zonecode: string; address: string }) => {
    setValue('zipCode', data.zonecode, { shouldDirty: true });
    setValue('address', data.address, { shouldDirty: true });
    setShowAddressSearch(false);
  };

  // 5. 렌더링 (읽기전용 / 수정가능 필드 분리)
  return (
    <>
      <Toast ref={toast} />
      <AddressSearchDialog
        visible={showAddressSearch}
        onHide={() => setShowAddressSearch(false)}
        onComplete={handleAddressComplete}
      />
      <div className="grid justify-content-center">
        <div className="col-12 md:col-8">
          <Card title="개인정보 수정">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Fieldset legend="기본 정보" className="mb-4">
                <div className="p-fluid formgrid grid">
                  <div className="field col-12 md:col-6">
                    <label htmlFor="loginId">로그인 ID</label>
                    <InputText id="loginId" value={fullUser.loginId} disabled />
                  </div>

                  <div className="field col-12 md:col-6">
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
                    <label htmlFor="recommender">추천인</label>
                    <InputText
                      id="recommenderId"
                      value={fullUser.recommender?.userNm || '-'}
                      disabled
                    />
                  </div>
                  {/* --- 수정 가능 --- */}
                  <div className="field col-12 md:col-6">
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
                    {errors.cellPhone && (
                      <small className="p-error">{errors.cellPhone.message}</small>
                    )}
                  </div>
                  <div className="field col-12 md:col-6">
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
                          placeholder="6자 이상 입력"
                          className={classNames({ 'p-invalid': fieldState.error })}
                        />
                      )}
                    />
                    {errors.password && (
                      <small className="p-error">{errors.password.message}</small>
                    )}
                  </div>
                </div>
              </Fieldset>
              <Fieldset legend="인사 및 주소 정보" className="mb-4">
                <div className="p-fluid formgrid grid">
                  <div className="field col-12 md:col-12">
                    <label>주민등록번호</label>
                    <div className="flex align-items-center gap-2">
                      <InputText
                        id="residentIdFront"
                        value={fullUser.residentIdFront || ''}
                        disabled
                      />
                      <span>-</span>
                      <InputText
                        id="residentIdBack"
                        value={fullUser.residentIdBack || ''}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="joinDate">입사일</label>
                    <Calendar
                      id="joinDate"
                      value={fullUser.joinDate ? new Date(fullUser.joinDate) : null}
                      dateFormat="yy-mm-dd"
                      disabled
                    />
                  </div>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="appointmentDate">위촉일</label>
                    <Calendar
                      id="appointmentDate"
                      value={fullUser.appointmentDate ? new Date(fullUser.appointmentDate) : null}
                      dateFormat="yy-mm-dd"
                      disabled
                    />
                  </div>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="zipCode">우편번호</label>
                    <div className="p-inputgroup">
                      <Controller
                        name="zipCode"
                        control={control}
                        render={({ field, fieldState }) => (
                          <InputText
                            id={field.name}
                            {...field}
                            value={field.value || ''}
                            placeholder="우편번호"
                            readOnly
                            className={classNames({ 'p-invalid': fieldState.error })}
                          />
                        )}
                      />
                      <Button
                        icon="pi pi-search"
                        type="button"
                        onClick={() => setShowAddressSearch(true)}
                        tooltip="주소 검색"
                      />
                    </div>
                    {errors.zipCode && <small className="p-error">{errors.zipCode.message}</small>}
                  </div>
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
                          placeholder="기본 주소"
                          className={classNames({ 'p-invalid': fieldState.error })}
                        />
                      )}
                    />
                    {errors.address && <small className="p-error">{errors.address.message}</small>}
                  </div>
                  <div className="field col-12">
                    <label htmlFor="addressDetail">상세주소</label>
                    <Controller
                      name="addressDetail"
                      control={control}
                      render={({ field, fieldState }) => (
                        <InputText
                          id={field.name}
                          {...field}
                          value={field.value || ''}
                          placeholder="상세 주소"
                          className={classNames({ 'p-invalid': fieldState.error })}
                        />
                      )}
                    />
                    {errors.addressDetail && (
                      <small className="p-error">{errors.addressDetail.message}</small>
                    )}
                  </div>
                </div>
              </Fieldset>
              <Fieldset legend="급여 계좌 정보" className="mb-4">
                <div className="p-fluid formgrid grid">
                  <div className="field col-12 md:col-4">
                    <label htmlFor="bank">은행</label>
                    <InputText
                      id="bankName"
                      value={getBankName(fullUser.bankCode as string)}
                      disabled
                    />
                  </div>
                  <div className="field col-12 md:col-8">
                    <label htmlFor="accountNumber">계좌번호</label>
                    <InputText id="accountNumber" value={fullUser.accountNumber} disabled />
                  </div>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="accountHolder">예금주</label>
                    <InputText id="accountHolder" value={fullUser.accountHolder} disabled />
                  </div>
                  <div className="field col-12 md:col-6">
                    <label htmlFor="accountRelation">관계</label>
                    <InputText id="accountRelation" value={fullUser.accountRelation} disabled />
                  </div>
                </div>
              </Fieldset>
            </form>
            <div className="p-fluid formgrid grid">
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
