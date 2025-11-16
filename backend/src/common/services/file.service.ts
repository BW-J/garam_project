import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath =
      this.configService.get<string>('UPLOAD_BASE_PATH') || './uploads';
  }

  /**
   * 파일 저장 (단일)
   * @param boardType 게시판 타입 (폴더명으로 사용)
   * @param file 업로드된 파일 객체
   */
  async saveFile(boardType: string, file: Express.Multer.File) {
    // 1. [보안] boardType 경로 조작 검증 (알파벳, 숫자, _ 만 허용)
    if (!/^[a-zA-Z0-9_]+$/.test(boardType)) {
      throw new BadRequestException('Invalid board type for file path.');
    }

    // 2. 저장 경로 생성
    const now = dayjs();
    const datePath = now.format('YYYY/MM/DD');

    const relativeDir = path.join(boardType, datePath);

    const uploadDir = path.join(this.basePath, relativeDir);

    try {
      // 폴더가 없으면 생성 (recursive: true)
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      this.logger.error(`Failed to create directory: ${uploadDir}`, err);
      throw new Error('File storage error');
    }

    // 3. [보안] 파일명 난수화 (UUID + 확장자)
    const saveName = `${uuidv4()}`;
    const fullPath = path.join(uploadDir, saveName);
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );

    // 4. 파일 쓰기
    // (Multer MemoryStorage를 사용 중이므로 file.buffer가 존재)
    await fs.writeFile(fullPath, file.buffer);

    const dbSaveName = path.join(datePath, saveName).replace(/\\/g, '/');

    return {
      originalName: originalName,
      saveName: dbSaveName,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * 파일 삭제
   */
  async deleteFile(boardType: string, saveName: string) {
    // 경로 조작 검증
    if (!/^[a-zA-Z0-9_]+$/.test(boardType)) {
      this.logger.warn(`Invalid boardType in deletion attempt: ${boardType}`);
      return;
    }

    if (saveName.includes('..')) {
      this.logger.warn(
        `Invalid path (Path Traversal) in deletion attempt: ${saveName}`,
      );
      return;
    }

    const fullPath = path.join(this.basePath, boardType, saveName);
    try {
      await fs.unlink(fullPath);
      this.logger.log(`File deleted: ${fullPath}`);
    } catch (err) {
      // 파일이 이미 없는 경우는 무시하거나 로그만 기록
      if ((err as any).code !== 'ENOENT') {
        this.logger.error(`Failed to delete file: ${fullPath}`, err);
      }
    }
  }

  /**
   * 파일 절대 경로 반환 (다운로드용)
   */
  getFilePath(boardType: string, saveName: string): string {
    // 경로 조작 검증
    if (!/^[a-zA-Z0-9_]+$/.test(boardType) || saveName.includes('..')) {
      throw new BadRequestException('Invalid path parameters.');
    }
    // saveName은 UUID 형식이므로 상대적으로 안전하지만 추가 검증 가능
    return path.join(this.basePath, boardType, saveName);
  }
}
