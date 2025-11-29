import { z } from 'zod';

/**
 * Zod를 사용한 사용자 폼 유효성 검사 스키마
 */
export const userFormSchema = z.object({
  // '신규' 여부를 식별하기 위한 플래그 (폼 데이터에 포함시킴)
  isNew: z.boolean().optional(),

  // User 타입 필드
  loginId: z.string().min(4, '로그인 ID는 4자 이상이어야 합니다.'),
  userNm: z.string().min(2, '사용자명은 2자 이상이어야 합니다.'),
  email: z.union([
    z.string().email('올바른 이메일 형식이 아닙니다.'),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]),
  cellPhone: z.string().nullable().optional().or(z.literal('')),

  password: z.string().nullable().optional(), // 비밀번호 필드는 기본적으로 선택 사항

  deptId: z
    .number()
    .nullable()
    .refine((val) => val != null && val > 0, {
      message: '부서는 필수입니다.',
    }),
  positionId: z
    .number()
    .nullable()
    .refine((val) => val != null && val > 0, {
      message: '직급은 필수입니다.',
    }),
  recommenderId: z.number().nullable().optional(),
  isActive: z.boolean(),

  birthDate: z.date().nullable().optional(),
  address: z.string().nullable().optional(),
  joinDate: z
    .date()
    .nullable()
    .refine((val) => val instanceof Date, {
      message: '입사일은 올바른 날짜여야 합니다.',
    }),
  appointmentDate: z
    .date()
    .nullable()
    .refine((val) => val instanceof Date, {
      message: '위촉일은 올바른 날짜여야 합니다.',
    }),

  zipCode: z.string().nullable().optional(),
  addressDetail: z.string().nullable().optional(),

  bankCode: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  accountRelation: z.string().nullable().optional(),

  // User 타입에 없는 필드 (Zod 스키마에만 존재)
  userId: z.number().optional(), // 수정 시 ID 식별용
});

/**
 * 신규/수정 시 비밀번호 정책을 다르게 적용하기 위한 상세 스키마
 */
export const refinedUserFormSchema = userFormSchema.refine(
  (data) => {
    // 1. '신규' (isNew = true)인 경우
    if (data.isNew) {
      // 비밀번호가 존재하고 6자 이상인지 확인
      return data.password && data.password.length >= 6;
    }
    // 2. '수정' (isNew = false)인 경우
    if (!data.isNew && data.password && data.password.length > 0) {
      // 비밀번호를 입력했다면 6자 이상이어야 함
      return data.password.length >= 6;
    }
    // 수정 시 비밀번호를 입력하지 않으면 (null or '') 통과
    return true;
  },
  {
    // 유효성 검사 실패 시 메시지
    message: '비밀번호는 6자 이상이어야 합니다. (신규 사용자는 필수)',
    // 이 에러를 'password' 필드와 연결
    path: ['password'],
  },
);

/**
 * React Hook Form에서 사용할 폼 데이터 타입
 */
export type UserFormData = z.infer<typeof refinedUserFormSchema>;
