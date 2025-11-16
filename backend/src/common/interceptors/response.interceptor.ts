import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Stream } from 'stream';

export interface ResponseFormat<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements
    NestInterceptor<T, ResponseFormat<T> | T | Stream | Buffer | StreamableFile>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T> | T | Stream | Buffer | StreamableFile> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Nest 내부에서 이미 응답이 포맷팅된 경우(예: Stream, Buffer 등)는 그대로 반환
        if (
          data &&
          (data instanceof StreamableFile ||
            data instanceof Stream ||
            Buffer.isBuffer(data))
        ) {
          return data;
        }

        // 정상 구조 포맷팅
        return {
          success: true,
          data: data ?? null,
          message: response.statusCode === 201 ? 'Created' : 'OK',
        };
      }),
    );
  }
}
