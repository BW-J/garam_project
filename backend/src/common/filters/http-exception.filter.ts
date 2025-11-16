import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message || (res as any).error || message;
    } else {
      // 👈 [3] HttpException이 아닌 모든 알 수 없는 에러를 로깅합니다.
      // (DepartmentService 등에서 DB 오류 발생 시 이 부분이 실행됩니다)
      this.logger.error(
        `[Unhandled Exception] ${request.method} ${request.url}`,
        exception, // 👈 스택 트레이스(stack trace)를 포함한 전체 에러 객체
      );
      // message는 보안을 위해 'Internal server error'를 유지합니다.
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
