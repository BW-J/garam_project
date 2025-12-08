import { z } from 'zod';

/**
 * Zod를 사용한 개인정보 수정 폼 유효성 검사 스키마
 */
export const profileFormSchema = z
  .object({
    // 수정 시 PK
    userId: z.number(),

    // 수정 가능 필드
    userNm: z.string().min(2, '사용자명은 2자 이상이어야 합니다.'),
    email: z.union([
      z.string().email('올바른 이메일 형식이 아닙니다.'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ]),

    cellPhone: z.string().nullable().optional().or(z.literal('')),

    //birthDate: z.date().nullable().optional(),
    address: z.string().nullable().optional(),
    //joinDate: z.date().nullable().optional(),
    //appointmentDate: z.date().nullable().optional(),

    zipCode: z.string().nullable().optional(),
    addressDetail: z.string().nullable().optional(),

    // bankCode: z.string().nullable().optional(),
    // accountNumber: z.string().nullable().optional(),
    // accountHolder: z.string().nullable().optional(),
    // accountRelation: z.string().nullable().optional(),

    // 비밀번호 (선택)
    password: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // ... (기존 refine 로직과 동일) ...
      if (data.password && data.password.length > 0) {
        return data.password.length >= 6;
      }
      return true;
    },
    {
      message: '비밀번호는 6자 이상이어야 합니다.',
      path: ['password'],
    },
  );

/**
 * React Hook Form에서 사용할 폼 데이터 타입
 */
export type ProfileFormData = z.infer<typeof profileFormSchema>;
