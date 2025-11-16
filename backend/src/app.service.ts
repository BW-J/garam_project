import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
  getMessage(): string {
    return 'API 통신 테스트';
  }
}
