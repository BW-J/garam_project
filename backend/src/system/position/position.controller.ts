import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { PositionService } from './position.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { SearchPositionDto } from './dto/search-position.dto';
import { Position } from 'src/core/entities/tb_position.entity';
import { PositionResponseDto } from './dto/Position-response.dto';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthorizedRequest } from 'src/types/http';
import { Permission } from 'src/common/decorators/permession.decorator';

@AuditEntity('POSITION')
@AuditKey('positionNm')
@Controller('system/position')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  /**
   * 직급 조회
   * @returns
   */
  @Activity('직급 조회')
  @Get()
  async findAllPosition(): Promise<PositionResponseDto[]> {
    return this.positionService.findAllPosition();
  }

  /**
   * 직급 단건 조회
   * @param id
   * @returns
   */
  @Activity('직급 단건 조회')
  @Get('id/:positionId')
  async findOnePosition(
    @Param('positionId') id: number,
  ): Promise<PositionResponseDto> {
    return this.positionService.findOnePosition(id);
  }

  /**
   * 직급 생성
   * @param dto
   * @param user
   * @returns
   */
  @Permission('ORG_MGMT', 'CREATE')
  @Activity('직급 생성')
  @Post()
  async create(
    @Body() dto: CreatePositionDto,
    @CurrentUser() user: any,
  ): Promise<PositionResponseDto> {
    return this.positionService.createPosition(dto, user.sub);
  }

  /**
   * 직급 수정
   * @param positionId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'UPDATE')
  @Activity('직급 수정')
  @Patch(':positionId')
  async update(
    @Param('positionId') positionId: number,
    @Body() dto: UpdatePositionDto,
    @Req() req: AuthorizedRequest,
  ): Promise<PositionResponseDto> {
    return this.positionService.updatePosition(positionId, dto, req);
  }

  /**
   * 직급 활성화/비활성화
   * @param positionId
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'DELETE')
  @Activity('직급 활성화/비활성화')
  @Patch('toggle/:positionId')
  async toggleActive(
    @Param('positionId') positionId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<Position> {
    return this.positionService.toggleActive(positionId, req);
  }

  /**
   * 직급 삭제
   * 실제 사용은 하지 않으나 일단 구현만 해 둔 상황
   * @param positionId
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'DELETE')
  @Activity('직급 삭제')
  @Delete(':positionId')
  async remove(
    @Param('positionId') positionId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.positionService.hardDelete(positionId, req);
    return { message: 'Position successfully deleted' };
  }

  //  검색 기능
  // 혹시몰라 남겨둠
  @Get('search')
  async search(
    @Query() query: SearchPositionDto,
  ): Promise<PositionResponseDto[]> {
    return this.positionService.search(query);
  }
}
