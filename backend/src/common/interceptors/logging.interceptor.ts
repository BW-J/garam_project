import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const now = Date.now();
    const isoTime = new Date(now).toISOString();

    this.logger.log(`[START] ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`[ END ] ${method} ${url} -> ${duration}ms}`);
      }),
    );
  }
}
