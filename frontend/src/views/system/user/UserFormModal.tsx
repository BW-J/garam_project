import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import api from 'src/api/axios';
import type { User } from 'src/config/types/User';
import type { Position } from 'src/config/types/Position';
import { Calendar } from 'primereact/calendar';

import { TreeSelect } from 'primereact/treeselect';
import { useTreeSelectData } from 'src/hooks/useTreeSelectData';

import { JSEncrypt } from 'jsencrypt';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { refinedUserFormSchema, type UserFormData } from 'src/config/schemas/userFormSchema';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

const RESET_PASSWORD_VALUE = '123456';

/**
 * 모달 Props 정의
 */
interface UserFormModalProps {
  visible: boolean;
  onHide: () => void;
  onSave: () => void;
  userToEdit: User | null; // null이면 신규 생성
}

/**
 * 신규 사용자 폼 기본값 (Zod 스키마 타입 기준)
 */
const NEW_USER_DEFAULTS: UserFormData = {
  isNew: true,
  loginId: '',
  userNm: '',
  email: '',
  cellPhone: '',
  password: '',
  deptId: null,
  positionId: null,
  recommenderId: null,
  birthDate: null,
  address: '',
  isActive: true,
  userId: undefined,
};

/**
 * 사용자 생성/수정 모달 컴포넌트
 */
export default function UserFormModal({ visible, onHide, onSave, userToEdit }: UserFormModalProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const toast = useRef<Toast | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const isNew = !userToEdit;

  const { options: deptOptions, loading: _deptLoading } = useTreeSelectData({
    apiUrl: '/system/department',
    idField: 'deptId',
    parentField: 'parentDeptId',
    labelField: 'deptNm',
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(refinedUserFormSchema),
    defaultValues: NEW_USER_DEFAULTS,
  });

  // 2. 모달이 열릴 때 폼 데이터 설정 및 관련 데이터 로드
  useEffect(() => {
    if (visible) {
      if (userToEdit) {
        reset({
          isNew: false,
          userId: userToEdit.userId,
          loginId: userToEdit.loginId,
          userNm: userToEdit.userNm,
          password: '',
          email: userToEdit.email || '',
          cellPhone: userToEdit.cellPhone || '',
          birthDate: userToEdit.birthDate ? new Date(userToEdit.birthDate) : null,
          address: userToEdit.address || '',
          deptId: userToEdit.deptId ?? null,
          positionId: userToEdit.positionId ?? null,
          recommenderId: userToEdit.recommenderId ?? null,
          isActive: userToEdit.isActive,
        });
      } else {
        reset(NEW_USER_DEFAULTS);
      }
      api
        .get('/system/position')
        .then((res) => setPositions(res.data))
        .catch((err) => console.error('직급 목록 로드 실패', err));
      api
        .get('/system/users')
        .then((res) => setUserList(res.data))
        .catch((err) => console.error('사용자 목록 로드 실패', err));
      if (!publicKey) {
        api
          .get('/auth/public-key')
          .then((res) => setPublicKey(res.data.publicKey))
          .catch((err) => console.error('공개키 로드 실패', err));
      }
    }
  }, [userToEdit, visible, publicKey, reset]);

  const handleResetPassword = () => {
    confirmDialog({
      message: `비밀번호를 '${RESET_PASSWORD_VALUE}'로 초기화 하시겠습니까?`,
      header: '비밀번호 초기화',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '초기화',
      rejectLabel: '취소',
      accept: async () => {
        if (!userToEdit || !userToEdit.userId) return;
        if (!publicKey) {
          toast.current?.show({ severity: 'error', summary: '오류', detail: '암호화 키 오류' });
          return;
        }

        try {
          // 1. 암호화
          const encrypt = new JSEncrypt();
          encrypt.setPublicKey(publicKey);
          const encryptedPassword = encrypt.encrypt(RESET_PASSWORD_VALUE);

          if (!encryptedPassword) {
            throw new Error('Encryption failed');
          }

          // 2. 비밀번호만 업데이트하는 API 호출 (기존 update API 재활용)
          //    다른 필드는 보내지 않고 password만 보냅니다.
          await api.patch(`/system/users/${userToEdit.userId}`, {
            password: encryptedPassword,
          });

          toast.current?.show({
            severity: 'success',
            summary: '완료',
            detail: `비밀번호가 '${RESET_PASSWORD_VALUE}'로 초기화되었습니다.`,
          });
          // 모달 닫기
          onHide();
        } catch (err: any) {
          console.error(err);
          toast.current?.show({
            severity: 'error',
            summary: '실패',
            detail: err.response?.data?.message || '초기화 실패',
          });
        }
      },
    });
  };

  // 5. 저장 (Submit) 핸들러 (암호화 로직 포함)
  const onSubmit = async (data: UserFormData) => {
    try {
      const payload = { ...data };

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
          toast.current?.show({ severity: 'error', summary: '오류', detail: '암호화 실패.' });
          return;
        }
        payload.password = encryptedPassword;
      } else {
        delete payload.password;
      }

      // API 호출
      if (!isNew) {
        await api.patch(`/system/users/${payload.userId}`, payload);
      } else {
        await api.post('/system/users', payload);
      }

      toast.current?.show({ severity: 'success', summary: '성공', detail: '저장되었습니다.' });
      onSave();
      onHide();
    } catch (error: any) {
      console.error('저장 실패', error);
      toast.current?.show({
        severity: 'error',
        summary: '저장 실패',
        detail: error.response?.data?.message || error.message || '오류가 발생했습니다.',
      });
    }
  };

  // 6. 모달 푸터 (버튼)
  const dialogFooter = (
    <>
      <Button label="취소" icon="pi pi-times" outlined onClick={onHide} />
      <Button
        label="저장"
        icon="pi pi-check"
        onClick={handleSubmit(onSubmit)}
        loading={isSubmitting}
      />
    </>
  );

  const filteredUserList = useMemo(() => {
    return userList
      .filter((u) => !u.deletedAt)
      .filter((u) => isNew || u.userId !== userToEdit?.userId);
  }, [userList, userToEdit, isNew]);

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        visible={visible}
        style={{ width: '40rem' }}
        header={isNew ? '사용자 추가' : '사용자 정보 수정'}
        breakpoints={{ '960px': '75vw', '641px': '95vw' }}
        modal
        className="p-fluid"
        footer={dialogFooter}
        onHide={onHide}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label htmlFor="loginId">로그인 ID *</label>
              <Controller
                name="loginId"
                control={control}
                render={({ field, fieldState }) => (
                  <InputText
                    id={field.name}
                    {...field}
                    disabled={!isNew}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.loginId && <small className="p-error">{errors.loginId.message}</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label htmlFor="userNm">사용자명 *</label>
              <Controller
                name="userNm"
                control={control}
                render={({ field, fieldState }) => (
                  <InputText
                    id={field.name}
                    {...field}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.userNm && <small className="p-error">{errors.userNm.message}</small>}
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
                    {...field}
                    value={field.value || ''}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.email && <small className="p-error">{errors.email.message}</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label htmlFor="cellPhone">핸드폰 번호</label>
              <Controller
                name="cellPhone"
                control={control}
                render={({ field, fieldState }) => (
                  <InputText
                    id={field.name}
                    type="tel"
                    {...field}
                    value={field.value || ''}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.cellPhone && <small className="p-error">{errors.cellPhone.message}</small>}
            </div>

            <div className="field col-12">
              <label htmlFor="password">{isNew ? '비밀번호 *' : '비밀번호 변경 (선택)'}</label>
              <div className="p-inputgroup">
                <Controller
                  name="password"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Password
                      id={field.name}
                      {...field}
                      value={field.value || ''}
                      feedback={false}
                      toggleMask
                      placeholder={isNew ? '6자 이상 (필수)' : '(변경 시 입력)'}
                      className={classNames('w-full', { 'p-invalid': fieldState.error })}
                      inputClassName="w-full"
                    />
                  )}
                />
                {/* 수정 모드일 때만 초기화 버튼 표시 */}
                {!isNew && (
                  <Button
                    type="button"
                    // label="초기화"
                    // className="p-button-warning"
                    icon="pi pi-refresh"
                    tooltip="비밀번호 초기화"
                    onClick={handleResetPassword}
                  />
                )}
              </div>
              {errors.password && <small className="p-error">{errors.password.message}</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label htmlFor="department">부서 *</label>
              <Controller
                name="deptId"
                control={control}
                render={({ field, fieldState }) => (
                  <TreeSelect
                    id={field.name}
                    value={field.value != null ? String(field.value) : null}
                    options={deptOptions}
                    onChange={(e) => {
                      const newValue = e.value === null ? null : Number(e.value);
                      field.onChange(newValue);
                    }}
                    onBlur={field.onBlur}
                    filter
                    showClear
                    placeholder="부서 선택"
                    className={classNames({ 'p-invalid': fieldState.error })}
                    style={{ width: '100%' }}
                    panelStyle={{ width: 'max-content', minWidth: '100%' }}
                  />
                )}
              />
              {errors.deptId && <small className="p-error">{errors.deptId.message}</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label htmlFor="position">직급 *</label>
              <Controller
                name="positionId"
                control={control}
                render={({ field, fieldState }) => (
                  <Dropdown
                    id={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    options={positions}
                    optionLabel="positionNm"
                    optionValue="positionId"
                    placeholder="직급 선택"
                    filter
                    showClear
                    onChange={(e: DropdownChangeEvent) => field.onChange(e.value ?? null)}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.positionId && <small className="p-error">{errors.positionId.message}</small>}
            </div>

            <div className="field col-12">
              <label htmlFor="recommender">추천인</label>
              <Controller
                name="recommenderId"
                control={control}
                render={({ field, fieldState }) => (
                  <Dropdown
                    id={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e: DropdownChangeEvent) => field.onChange(e.value ?? null)}
                    options={filteredUserList}
                    optionLabel="userNm"
                    optionValue="userId"
                    placeholder="추천인 검색 (이름)"
                    filter
                    showClear
                    virtualScrollerOptions={{ itemSize: 38 }}
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.recommenderId && (
                <small className="p-error">{errors.recommenderId.message}</small>
              )}
            </div>

            <div className="field col-12 md:col-6">
              <label htmlFor="birthDate">생년월일</label>
              <Controller
                name="birthDate"
                control={control}
                render={({ field, fieldState }) => (
                  <Calendar
                    id={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="YYYY-MM-DD"
                    dateFormat="yy-mm-dd"
                    showIcon
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.birthDate && <small className="p-error">{errors.birthDate.message}</small>}
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
                    className={classNames({ 'p-invalid': fieldState.error })}
                  />
                )}
              />
              {errors.address && <small className="p-error">{errors.address.message}</small>}
            </div>

            <div className="field col-12">
              <label htmlFor="isActive" className="mr-3">
                활성화 여부
              </label>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <InputSwitch id={field.name} checked={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
