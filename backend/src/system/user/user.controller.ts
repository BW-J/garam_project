import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Query,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import type { AuthorizedRequest } from 'src/types/http';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permission } from 'src/common/decorators/permession.decorator';
import { UserGenealogyNodeDto } from './dto/user-genealogy-node.dto';

@Controller('/system/users')
@AuditEntity('USER')
@AuditKey('userNm')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 내 프로필 조회
   * @param user
   * @returns
   */
  @Get('me')
  @Activity('프로필 보기')
  async getMyProfile(@CurrentUser() user): Promise<UserResponseDto> {
    return this.userService.findOneById(user.sub);
  }

  /**
   * 내 하위 계보도 조회
   * @param user
   * @returns
   */
  @Get('me/genealogy')
  @Activity('하위 계보도 조회')
  async getMyGenealogy(
    @CurrentUser() user,
    @Query('depth', new ParseIntPipe({ optional: true })) depth?: number,
  ): Promise<UserGenealogyNodeDto[]> {
    return this.userService.findGenealogyTree(user.sub, depth); // 최대 10단계
  }

  /**
   * 하위 계보도 조회 (관리자용)
   * @param userId
   * @param depth
   * @returns
   */
  @Get(':userId/genealogy')
  @Permission('USER_MGMT', 'VIEW')
  @Activity('사용자 계보도 조회')
  async getUserGenealogy(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('depth', new ParseIntPipe({ optional: true })) depth?: number,
  ): Promise<UserGenealogyNodeDto[]> {
    // 9999단계까지 조회 (사실상 제한 없음)
    const maxDepth = 9999;
    return this.userService.findGenealogyTree(userId, maxDepth);
  }

  @Permission('USER_MGMT', 'UPDATE')
  @Patch('reset-password/:userId')
  @Activity('비밀번호 초기화')
  async resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('password') password: string,
    @Req() req: AuthorizedRequest,
  ): Promise<UserResponseDto> {
    return this.userService.resetPassword(userId, password, req);
  }

  /**
   * 내정보 수정
   * @param userId
   * @param dto
   * @param req
   * @returns
   */
  @Patch('me/:userId')
  @Activity('개인정보 수정')
  async updateForMe(
    @Param('userId') userId: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(userId, dto, user);
  }

  /**
   * 전체 목록 조회 (삭제포함 여부: ?includeDeleted=true)
   * @param includeDeleted
   * @param page
   * @param limit
   * @returns
   */
  @Get()
  @Activity('사용자 전체조회')
  async findAllUser(): Promise<UserResponseDto[]> {
    return this.userService.findAllUser();
  }

  /**
   * 상세 조회 (loginId로)
   * @param userId
   * @returns
   */
  @Get('id/:userId')
  @Activity('상세 정보')
  async findOneById(@Param('userId') userId: number): Promise<UserResponseDto> {
    return this.userService.findOneById(userId);
  }

  /**
   * 검색 (다중 조건)
   * @param query
   * @param page
   * @param limit
   * @returns
   */
  @Get('search')
  @Activity('사용자 검색')
  async search(
    @Query() query: SearchUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.search({ ...query, page, limit });
  }

  /**
   * 사용자 생성
   * @param dto
   * @param user
   * @returns
   */
  @Post()
  @Permission('USER_MGMT', 'CREATE')
  @Activity('사용자 생성')
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: any,
  ): Promise<UserResponseDto> {
    return this.userService.createUser(dto, user.sub);
  }

  /**
   * 사용자 수정
   * @param userId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('USER_MGMT', 'UPDATE')
  @Patch(':userId')
  @Activity('사용자 수정')
  async update(
    @Param('userId') userId: number,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthorizedRequest,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(userId, dto, req);
  }

  /**
   * 사용자 활성화/비활성화
   * @param userId
   * @param req
   * @returns
   */
  @Permission('USER_MGMT', 'UPDATE')
  @Patch('toggle/:userId')
  @Activity('사용자 활성화/비활성화')
  async toggleActive(
    @Param('userId') userId: number,
    @Req() req: AuthorizedRequest,
  ) {
    return this.userService.toggleActive(userId, req);
  }

  /**
   * 사용자 삭제
   * @param userId
   * @param req
   * @returns
   */
  @Permission('USER_MGMT', 'DELETE')
  @Delete(':userId')
  @Activity('사용자 삭제')
  async remove(
    @Param('userId') userId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.userService.softDelete(userId, req);
    return { message: 'User successfully deleted (soft delete)' } as const;
  }

  /**
   * 사용자 복구
   * @param userId
   * @param req
   * @returns
   */
  @Permission('USER_MGMT', 'UPDATE')
  @Patch('restore/:userId')
  @Activity('사용자 복구')
  async restore(
    @Param('userId') userId: number,
    @Req() req: AuthorizedRequest,
  ) {
    return this.userService.restore(userId, req);
  }

  @Post('me/extend-password')
  @Activity('비밀번호 만료 연장')
  async extendPassword(@CurrentUser() user: any) {
    await this.userService.extendPasswordExpiry(user.sub);
    return { success: true, message: '비밀번호 유효기간이 연장되었습니다.' };
  }
}
