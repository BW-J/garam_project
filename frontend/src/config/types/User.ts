import type { Department } from './Department';
import type { Position } from './Position';

/**
 * 사용자 정보 타입
 */
export interface User {
  userId: number;
  loginId: string;
  userNm: string;
  email?: string | null;
  cellPhone?: string | null;
  isActive: boolean;
  deletedAt?: Date | null;

  // 관계 데이터 (조인 시 포함)
  department?: Department | null;
  position?: Position | null;
  recommender?: User;
  birthDate?: Date | string | null;
  address?: string | null;

  deptId?: number | null;
  positionId?: number | null;
  recommenderId?: number | null;

  password?: string;

  joinDate?: Date | string | null;
  appointmentDate?: Date | string | null;

  zipCode?: string;
  addressDetail?: string;

  bankCode?: string;
  accountNumber?: string;
  accountHolder?: string;
  accountRelation?: string;

  bank?: {
    bankCode: string;
    bankName: string;
  };
}
