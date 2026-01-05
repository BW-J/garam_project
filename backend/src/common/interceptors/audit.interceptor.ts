import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

import {
  AUDIT_ENTITY_KEY,
  AUDIT_KEY,
} from 'src/common/decorators/audit.decorator';
import { diffObjects, maskSensitiveData } from 'src/common/utils/audit.util';
import { AuditLogService } from 'src/system/logs/services/audit-log.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  protected readonly logger = new Logger(this.constructor.name);
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const userId = req.user?.sub ?? null;

    // 엔티티 메타데이터 추출
    const entityName =
      this.reflector.get<string>(AUDIT_ENTITY_KEY, context.getHandler()) ||
      this.reflector.get<string>(AUDIT_ENTITY_KEY, context.getClass());
    const entityKeyName =
      this.reflector.get<string>(AUDIT_KEY, context.getHandler()) ||
      this.reflector.get<string>(AUDIT_KEY, context.getClass());

    // 작업 종류 판별
    let operation: 'INSERT' | 'UPDATE' | 'DELETE' | null = null;
    if (method === 'POST') operation = 'INSERT';
    else if (method === 'PATCH' || method === 'PUT') operation = 'UPDATE';
    else if (method === 'DELETE') operation = 'DELETE';

    return next.handle().pipe(
      tap(async (result) => {
        if (!operation || userId == null || !entityName) return;

        const before = req._auditBefore ?? null;
        const after = result ?? null;

        // PK 추출
        const entityKey =
          result?.[entityKeyName] ?? req.params?.[entityKeyName] ?? null;

        // changes 계산 INSERT시에는 after / UPDATE시에는 변경사항 / DELETE시에는 before
        // 케이스별 처리
        let changes: any = null;

        if (operation === 'INSERT') {
          changes = after; // 신규 데이터 전체 기록
        } else if (operation === 'UPDATE') {
          changes = diffObjects(before, after); // 변경 필드만

          if (changes && req.body && typeof req.body === 'object') {
            const bodyKeys = Object.keys(req.body);

            if (
              changes['residentIdBack'] &&
              !bodyKeys.includes('residentIdBack')
            ) {
              delete changes['residentIdBack'];
            }

            if (
              changes['passwordChangedAt'] &&
              !bodyKeys.includes('password')
            ) {
              delete changes['passwordChangedAt'];
            }
          }
        } else if (operation === 'DELETE') {
          changes = before; // 삭제 전 데이터 전체 기록
        }

        if (changes) {
          changes = maskSensitiveData(changes);
        }

        if (
          !changes ||
          (operation === 'UPDATE' && Object.keys(changes).length === 0)
        ) {
          return;
        }

        await this.auditLogService.record(
          entityName,
          entityKey ? String(entityKey) : null,
          operation,
          userId,
          changes,
        );
      }),
    );
  }
}
