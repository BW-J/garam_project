import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Board } from 'src/core/entities/tb_board.entity';
import { Attachment } from 'src/core/entities/tb_attachment.entity';
import { FileService } from 'src/common/services/file.service';
import * as fs from 'fs';
import {
  buildPaginationMeta,
  getPaginationParams,
} from 'src/common/utils/pagination.util';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { BoardSearchDto } from './dto/board-search.dto';
import type { Response } from 'express';
import { RolePermissionsService } from '../role/role-permission.service';

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(Board) private boardRepo: Repository<Board>,
    @InjectRepository(Attachment) private attachRepo: Repository<Attachment>,
    private fileService: FileService,
    private dataSource: DataSource,
    private rolePermissionsService: RolePermissionsService,
  ) {}

  async createBoard(
    boardType: string,
    dto: any,
    files: Express.Multer.File[],
    userId: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const newBoard = manager.create(Board, {
        boardType,
        title: dto.title,
        content: dto.content,
        isImportant: dto.isImportant === 'true' || dto.isImportant === true,
        author: { userId },
        createdBy: userId,
        updatedBy: userId,
      });
      const savedBoard = await manager.save(newBoard);

      if (files?.length > 0) {
        for (const file of files) {
          // boardType을 폴더명으로 사용하여 파일 저장
          const fileInfo = await this.fileService.saveFile(boardType, file);
          const attachment = manager.create(Attachment, {
            board: savedBoard,
            ...fileInfo, // originalName, saveName(상대경로 포함), size, mimeType
            createdBy: userId,
            updatedBy: userId,
          });
          await manager.save(attachment);
        }
      }
      return savedBoard;
    });
  }

  async findAll(
    boardType: string,
    query: BoardSearchDto,
  ): Promise<PaginatedResponseDto<Board>> {
    const { page, limit, skip, take } = getPaginationParams(query);
    const { keyword, searchType } = query;

    const qb = this.boardRepo
      .createQueryBuilder('board')
      .leftJoinAndSelect('board.author', 'author') // 작성자 정보 포함
      .leftJoinAndSelect('board.attachments', 'files') // 목록에서 첨부파일까지 보여줄지 결정 필요 (보통은 상세에서만)
      .where('board.boardType = :boardType', { boardType })
      .andWhere('board.isActive = :isActive', { isActive: true });

    // 검색 조건 적용
    if (keyword) {
      if (searchType === 'title') {
        qb.andWhere('board.title ILIKE :kw', { kw: `%${keyword}%` });
      } else if (searchType === 'content') {
        qb.andWhere('board.content ILIKE :kw', { kw: `%${keyword}%` });
      } else if (searchType === 'author') {
        qb.andWhere('author.userNm ILIKE :kw', { kw: `%${keyword}%` });
      } else {
        // 기본: 제목 + 내용 통합 검색
        qb.andWhere('(board.title ILIKE :kw OR board.content ILIKE :kw)', {
          kw: `%${keyword}%`,
        });
      }
    }

    // 정렬: 중요 게시글 우선, 그 다음 최신순
    qb.orderBy('board.isImportant', 'DESC').addOrderBy(
      'board.createdAt',
      'DESC',
    );

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      data: items,
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  async getBoardDetail(boardId: number) {
    const board = await this.boardRepo.findOne({
      where: { boardId },
      relations: ['author', 'attachments'],
    });
    if (!board) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    await this.boardRepo.increment({ boardId }, 'viewCount', 1);
    return board;
  }

  /**
   * 게시글 수정 (파일 포함)
   */
  async updateBoard(
    boardType: string,
    boardId: number,
    dto: any, // UpdateBoardDto (CreatePostDto와 유사)
    files: Express.Multer.File[],
    deletedAttachmentIds: number[], // 삭제할 파일 ID 목록
    currentUser: any,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const boardRepo = manager.getRepository(Board);
      const attachRepo = manager.getRepository(Attachment);

      const board = await boardRepo.findOne({ where: { boardId } });
      if (!board) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      // 1. 권한 체크 (삭제와 동일한 권한 사용)
      const isSuperAdmin = currentUser.isSuperAdmin === true;
      const isAuthor = board.createdBy === currentUser.sub;
      const canUpdate = await this.rolePermissionsService.hasPermission(
        currentUser.roleIds,
        boardType,
        'UPDATE', // 'UPDATE' 권한 체크
      );

      if (!isSuperAdmin && !isAuthor && !canUpdate) {
        throw new ForbiddenException('이 게시글을 수정할 권한이 없습니다.');
      }

      // 2. 게시글 텍스트 정보 업데이트
      board.title = dto.title;
      board.content = dto.content;
      board.isImportant =
        dto.isImportant === 'true' || dto.isImportant === true;
      board.updatedBy = currentUser.sub;
      await manager.save(board);

      // 3. 기존 첨부파일 삭제 (요청된 경우)
      if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
        // [보안] 삭제하려는 파일이 이 게시글 소유인지 재확인
        const attachmentsToDelete = await attachRepo.find({
          where: {
            attachId: In(deletedAttachmentIds),
            boardId: boardId,
          },
        });

        for (const attach of attachmentsToDelete) {
          // 물리적 파일 삭제
          await this.fileService.deleteFile(board.boardType, attach.saveName);
          // DB 레코드 삭제
          await attachRepo.delete(attach.attachId);
        }
      }

      // 4. 새 첨부파일 추가 (업로드된 경우)
      if (files?.length > 0) {
        for (const file of files) {
          const fileInfo = await this.fileService.saveFile(
            board.boardType,
            file,
          );
          const attachment = attachRepo.create({
            board: board,
            ...fileInfo,
            createdBy: currentUser.sub,
            updatedBy: currentUser.sub,
          });
          await manager.save(attachment);
        }
      }

      return board;
    });
  }

  /**
   * 게시글 삭제 (Soft Delete)
   * - 작성자 본인 또는 관리자만 삭제 가능하도록 권한 체크가 필요할 수 있음
   */
  async deleteBoard(boardType: string, boardId: number, currentUser: any) {
    const board = await this.boardRepo.findOne({ where: { boardId } });
    if (!board) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // 1. 슈퍼어드민인가?
    const isSuperAdmin = currentUser.isSuperAdmin === true;

    // 2. 작성자인가? (board.createdBy는 게시글 작성자의 ID)
    const isAuthor = board.createdBy === currentUser.sub;

    // 3. 'DELETE' 권한이 있는가?
    // (boardType은 URL 파라미터로 넘어온 메뉴 코드(예: 'NOTICE')와 일치해야 함)
    const canDelete = await this.rolePermissionsService.hasPermission(
      currentUser.roleIds,
      boardType,
      'DELETE', // 'delete'가 아닌 'DELETE' (DB의 actionCd 기준) - 확인 필요
    );

    // 셋 중 하나도 해당하지 않으면 권한 없음
    if (!isSuperAdmin && !isAuthor && !canDelete) {
      throw new ForbiddenException('이 게시글을 삭제할 권한이 없습니다.');
    }

    // Soft Delete 실행
    board.updatedBy = currentUser.sub;
    board.isActive = false;
    await this.boardRepo.save(board); // updatedBy 기록
    await this.boardRepo.softDelete({ boardId }); // deletedAt 설정

    return { success: true, message: '게시글이 삭제되었습니다.' };
  }

  /**
   * 파일 다운로드
   */
  async downloadFile(attachId: number, res: Response): Promise<StreamableFile> {
    const attachment = await this.attachRepo.findOne({
      where: { attachId },
      relations: ['board'], // boardType을 알기 위해 게시글 정보 필요
    });

    if (!attachment) {
      throw new NotFoundException('File not found');
    }

    // 1. 실제 파일 경로 획득
    const filePath = this.fileService.getFilePath(
      attachment.board.boardType,
      attachment.saveName,
    );

    // 2. 파일 존재 여부 최종 확인
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Physical file not found on server.');
    }

    // 3. 응답 헤더 설정 (파일명 한글 처리 등)
    const encodedFileName = encodeURIComponent(attachment.originalName);
    res.set({
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      'Content-Length': String(attachment.size),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    // 4. 스트림 반환
    const file = fs.createReadStream(filePath);
    return new StreamableFile(file);
  }
}
