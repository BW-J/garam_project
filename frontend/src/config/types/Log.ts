import type { User } from './User';

/**
 * 행위 로그 (tb_user_activity_log)
 */
export interface ActivityLog {
  activityId: number;
  userId: number;
  actionName: string | null;
  method: string;
  path: string;
  ipAddr: string | null;
  userAgent: string | null;
  params: Record<string, any> | null;
  resultStatus: number | null;
  createdAt: Date;
  // JOIN된 사용자 정보
  user?: User;
}

/**
 * 감사 로그 (tb_audit_log)
 */
export interface AuditLog {
  auditId: number;
  entityNm: string;
  entityKey: string | null;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  changedBy: number | null;
  changes: Record<string, { old: any; new: any }> | null;
  createdAt: Date;
  // JOIN된 사용자 정보
  changedByUser?: User;
}
