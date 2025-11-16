import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './services/crypto.service';
import { FileService } from './services/file.service';

@Global() // 이 모듈을 전역으로 설정
@Module({
  imports: [ConfigModule], // CryptoService가 ConfigService를 쓰므로 임포트
  providers: [CryptoService, FileService],
  exports: [CryptoService, FileService], // 다른 모듈에서 주입할 수 있도록 export
})
export class CommonUtilsModule {}
