import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  Query,
  StreamableFile,
  Res,
  ParseIntPipe,
  Delete,
  Patch,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { BoardService } from './board.service';
import { BoardSearchDto } from './dto/board-search.dto';
import type { Response } from 'express';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { FileExtensionValidator } from 'src/common/validators/file-extension.validator';

const SAFE_FILE_REGEX =
  /\.(jpg|jpeg|png|gif|pdf|xlsx|xls|doc|docx|hwp|zip|txt|ppt|pptx)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const fileValidationPipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
    new FileExtensionValidator({ allowedExtensions: SAFE_FILE_REGEX }),
  ],
  fileIsRequired: false,
});

@Controller('board/:boardType')
@AuditEntity('BOARD')
@AuditKey('boardType')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  @Activity('게시글 작성')
  @UseInterceptors(FilesInterceptor('files', 5)) // 최대 5개
  async create(
    @Param('boardType') boardType: string,
    @Body() dto: CreateBoardDto,
    @UploadedFiles(fileValidationPipe)
    files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    return this.boardService.createBoard(boardType, dto, files, user);
  }

  @Get(':boardId')
  async findOne(@Param('boardId') boardId: number) {
    return this.boardService.getBoardDetail(boardId);
  }

  /**
   * 게시글 목록 조회
   * GET /api/board/NOTICE?page=1&limit=10&keyword=검색어
   */
  @Get()
  // @Permission(...) // 조회 권한 체크 필요 시 추가
  async findAll(
    @Param('boardType') boardType: string,
    @Query() query: BoardSearchDto,
  ) {
    return this.boardService.findAll(boardType, query);
  }

  /**
   * 게시글 수정 (PATCH /board/:boardType/:boardId)
   */
  @Patch(':boardId')
  @Activity('게시글 수정')
  // @Permission(...) // 필요시 'UPDATE' 권한 체크
  @UseInterceptors(FilesInterceptor('files', 5)) // 새 파일 업로드
  async update(
    @Param('boardType') boardType: string,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: UpdateBoardDto, // CreatePostDto
    @UploadedFiles(fileValidationPipe)
    files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    // FormData로 넘어온 'deletedAttachmentIds' (JSON 문자열) 파싱
    let deletedIds: number[] = [];
    if (dto.deletedAttachmentIds) {
      try {
        deletedIds = JSON.parse(dto.deletedAttachmentIds);
      } catch (e) {
        throw new BadRequestException(
          'Invalid format for deletedAttachmentIds.',
        );
      }
    }

    return this.boardService.updateBoard(
      boardType,
      boardId,
      dto,
      files,
      deletedIds,
      user,
    );
  }

  /**
   * 게시글 삭제
   * DELETE /board/:boardType/:boardId
   */

  @Activity('게시글 삭제')
  @Delete(':boardId')
  async delete(
    @Param('boardType') boardType: string,
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: any,
  ) {
    return this.boardService.deleteBoard(boardType, boardId, user);
  }

  @Get('download/:attachId')
  async download(
    @Param('attachId', ParseIntPipe) attachId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.boardService.downloadFile(attachId, res);
  }
}
