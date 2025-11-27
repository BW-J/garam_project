import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as forge from 'node-forge';

const CACHE_KEY_PUBLIC = 'rsa_public_key';
const CACHE_KEY_PRIVATE = 'rsa_private_key';

@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private readonly keyCacheTtl: number; // ms

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const ttlSeconds = parseInt(
      process.env.RSA_KEY_CACHE_TTL_SEC || '604800',
      10,
    );
    this.keyCacheTtl = ttlSeconds * 1000;
  }

  /**
   *  서버 시작 시 키가 캐시에 없으면 생성
   */
  async onModuleInit() {
    await this.getPublicKey(); // (내부적으로 키 생성 및 캐시)
  }

  /**
   * 동적 RSA 키 쌍 생성 및 캐시
   */
  private async generateAndCacheKeys(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    this.logger.log('Generating new RSA key pair...');
    // 비동기 방식이 NestJS 환경에 더 적합
    return new Promise((resolve, reject) => {
      forge.pki.rsa.generateKeyPair(
        { bits: 2048, workers: -1 },
        (err, keypair) => {
          if (err) {
            this.logger.error('RSA key pair generation failed.', err);
            return reject(err);
          }

          const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
          const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);

          // 캐시에 저장 (ms 단위 TTL)
          Promise.all([
            this.cacheManager.set(
              CACHE_KEY_PUBLIC,
              publicKeyPem,
              this.keyCacheTtl,
            ),
            this.cacheManager.set(
              CACHE_KEY_PRIVATE,
              privateKeyPem,
              this.keyCacheTtl,
            ),
          ]).then(() => {
            this.logger.log('New RSA key pair generated and cached.');
            resolve({ publicKey: publicKeyPem, privateKey: privateKeyPem });
          });
        },
      );
    });
  }

  /**
   *  공개키 조회 (캐시 우선)
   */
  async getPublicKey(): Promise<string> {
    let publicKey = await this.cacheManager.get<string>(CACHE_KEY_PUBLIC);
    if (publicKey) {
      return publicKey;
    }

    // 캐시 미스: 생성
    const { publicKey: newKey } = await this.generateAndCacheKeys();
    return newKey;
  }

  /**
   * 비밀키 조회 (캐시 우선)
   */
  private async getPrivateKey(): Promise<string> {
    let privateKey = await this.cacheManager.get<string>(CACHE_KEY_PRIVATE);
    if (privateKey) {
      return privateKey;
    }

    // 캐시 미스: 생성 (공개키와 짝이 맞아야 하므로 동시 생성)
    const { privateKey: newKey } = await this.generateAndCacheKeys();
    return newKey;
  }

  /**
   * RSA 복호화 (동적 키 사용)
   */
  async decryptPassword(encrypted: string): Promise<string> {
    try {
      const privateKey = await this.getPrivateKey();

      const buf = Buffer.from(encrypted, 'base64');
      const out = crypto.privateDecrypt(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
        buf,
      );
      const decryptedString = out.toString('utf8');

      if (decryptedString.includes('\uFFFD')) {
        throw new Error(
          'Decryption resulted in invalid UTF-8, likely key mismatch.',
        );
      }

      return decryptedString;
    } catch (error) {
      this.logger.error('Failed to decrypt password.', error.stack);
      throw new BadRequestException(
        '복호화에 실패했습니다. 키가 만료되었을 수 있으니 페이지를 새로고침하세요.',
      );
    }
  }
}
