import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'audit_entity';
export const AUDIT_KEY = 'audit_key';

/**
 * @AuditEntity('tb_department')
 * 해당 컨트롤러/서비스에서 감사 로그에 기록할 테이블명 지정
 */
export const AuditEntity = (entityName: string) =>
  SetMetadata(AUDIT_ENTITY_KEY, entityName);

/**
 * @AuditKey('deptId')
 * 감사 로그에서 사용할 PK 필드명 지정
 */
export const AuditKey = (fieldName: string) =>
  SetMetadata(AUDIT_KEY, fieldName);
