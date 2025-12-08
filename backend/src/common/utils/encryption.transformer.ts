import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const IV_LENGTH = 16;
export class EncryptionTransformer implements ValueTransformer {
  private static cachedKey: Buffer | null = null;

  private get key(): Buffer {
    if (EncryptionTransformer.cachedKey) {
      return EncryptionTransformer.cachedKey;
    }

    const keyStr = process.env.ENCRYPTION_KEY;
    if (!keyStr) {
      throw new Error('ENCRYPTION_KEY is not defined');
    }
    // 키가 없으면 생성 후 저장 (최초 1회만 실행됨)
    EncryptionTransformer.cachedKey = crypto.scryptSync(keyStr, 'salt', 32);
    return EncryptionTransformer.cachedKey;
  }

  to(value: string): string {
    if (!value) return value;
    const keyStr = process.env.ENCRYPTION_KEY;
    if (!keyStr) {
      throw new Error('ENCRYPTION_KEY is not defined');
    }
    // 암호화 (AES-256-CBC)
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    let encrypted = cipher.update(value);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  from(value: string): string {
    if (!value || !value.includes(':')) return value;
    // 복호화
    try {
      const textParts = value.split(':');
      const ivHex = textParts.shift();
      const encryptedHex = textParts.join(':');

      if (!ivHex) return value;
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (e) {
      return value; // 복호화 실패 시 원본(또는 빈값) 리턴
    }
  }
}
