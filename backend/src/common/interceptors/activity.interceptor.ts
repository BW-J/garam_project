import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { ActivityLogService } from 'src/system/logs/services/activity-log.service';
import { ACTIVITY_ACTION_KEY } from 'src/common/decorators/activity.decorator';
import { maskSensitiveData } from '../utils/audit.util';

// 큰 요청 본문을 저장하기 전에 제거하거나 자르는 유틸리티 함수 (예시)
const sanitizeBody = (body: any, maxSize = 2048) => {
  if (typeof body === 'object' && body !== null) {
    try {
      const bodyString = JSON.stringify(body);
      if (bodyString.length > maxSize) {
        return {
          ...body,
          // 크기가 클 경우, 본문을 잘라내고 크기 정보를 추가
          __truncated: bodyString.substring(0, maxSize / 2) + '...',
          __size: bodyString.length,
        };
      }
      return body;
    } catch (e) {
      return { error: 'Failed to serialize body' };
    }
  }
  return body;
};

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse<Response>();
    const user = req.user;
    const userId = user?.sub ?? null;

    const method = req.method;
    if ('GET' === method) {
      return next.handle();
    }
    // 데코레이터 기반 액션명 우선
    const handlerAction =
      this.reflector.get<string>(ACTIVITY_ACTION_KEY, context.getHandler()) ||
      this.reflector.get<string>(ACTIVITY_ACTION_KEY, context.getClass());

    const pathFallback = req.originalUrl || req.url;

    const actionName = handlerAction || pathFallback || 'UNKNOWN_ACTION';

    const path = req.originalUrl || req.url;
    // const ipAddr =
    //   req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    //   req.connection.remoteAddress ||
    //   null;
    const ipAddr = req.ip;
    const userAgent = req.headers['user-agent'];

    const params = {
      body: sanitizeBody(maskSensitiveData(req.body)),
      query: req.query,
      params: req.params,
    };

    const start = Date.now();

    return next.handle().pipe(
      tap(async () => {
        if (userId == null || !handlerAction) return;
        const duration = Date.now() - start;
        await this.activityLogService.record({
          userId,
          actionName,
          method,
          path,
          ipAddr,
          userAgent,
          params,
          resultStatus: res.statusCode,
        });
      }),
    );
  }
}
