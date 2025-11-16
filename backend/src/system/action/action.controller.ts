import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Req,
  Delete,
  Query,
} from '@nestjs/common';
import { Activity } from 'src/common/decorators/activity.decorator';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Action } from 'src/core/entities/tb_action.entity';
import type { AuthorizedRequest } from 'src/types/http';
import { CreateActionDto } from './dto/create-action.dto';
import { actionResponseDto } from './dto/Action-response.dto';
import { SearchActionDto } from './dto/search-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { ActionService } from './action.service';
import { Permission } from 'src/common/decorators/permession.decorator';

@AuditEntity('ACTION')
@AuditKey('actionNm')
@Controller('system/action')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  /**
   * 행동 조회
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'VIEW')
  @Activity('행동 조회')
  @Get()
  async findAllaction(): Promise<actionResponseDto[]> {
    return this.actionService.findAllaction();
  }

  /**
   * 행동 단건 조회
   * @param id
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'VIEW')
  @Activity('행동 단건 조회')
  @Get('id/:actionId')
  async findOneAction(
    @Param('actionId') id: number,
  ): Promise<actionResponseDto> {
    return this.actionService.findOneAction(id);
  }

  /**
   * 행동 생성
   * @param dto
   * @param user
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'CREATE')
  @Activity('행동 생성')
  @Post()
  async create(
    @Body() dto: CreateActionDto,
    @CurrentUser() user: any,
  ): Promise<actionResponseDto> {
    return this.actionService.createAction(dto, user.sub);
  }

  /**
   * 행동 수정
   * @param actionId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'UPDATE')
  @Activity('행동 수정')
  @Patch(':actionId')
  async update(
    @Param('actionId') actionId: number,
    @Body() dto: UpdateActionDto,
    @Req() req: AuthorizedRequest,
  ): Promise<actionResponseDto> {
    return this.actionService.updateAction(actionId, dto, req);
  }

  /**
   * 행동 활성화/비활성화
   * @param actionId
   * @param req
   * @returns
   */
  @Permission('RESOURCE_MGMT', 'DELETE')
  @Activity('행동 활성화/비활성화')
  @Patch('toggle/:actionId')
  async toggleActive(
    @Param('actionId') actionId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<Action> {
    return this.actionService.toggleActive(actionId, req);
  }

  /**
   * 행동 삭제
   * 실제 사용은 하지 않으나 일단 구현만 해 둔 상황
   * @param actionId
   * @param req
   * @returns
   */
  @Activity('행동 삭제')
  @Delete(':actionId')
  async remove(
    @Param('actionId') actionId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.actionService.hardDelete(actionId, req);
    return { message: 'action successfully deleted' };
  }

  //  검색 기능
  // 혹시몰라 남겨둠
  @Get('search')
  async search(@Query() query: SearchActionDto): Promise<actionResponseDto[]> {
    return this.actionService.search(query);
  }
}
