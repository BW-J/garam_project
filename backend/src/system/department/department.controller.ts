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
  Logger,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { SearchDepartmentDto } from './dto/search-department.dto';
import { Department } from 'src/core/entities/tb_department.entity';
import { AuditEntity, AuditKey } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Activity } from 'src/common/decorators/activity.decorator';
import type { AuthorizedRequest } from 'src/types/http';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { Permission } from 'src/common/decorators/permession.decorator';

@AuditEntity('DEPARTMENT')
@AuditKey('deptNm')
@Controller('system/department')
export class DepartmentController {
  protected readonly logger = new Logger(this.constructor.name);
  constructor(private readonly departmentService: DepartmentService) {}

  /**
   * 부서  조회
   * @returns
   */
  @Activity('부서 조회')
  @Get()
  async findFullTree(): Promise<DepartmentResponseDto[]> {
    return this.departmentService.findAllDepartment();
  }

  /**
   * 하위 부서 트리 조회
   * @param deptId
   * @returns
   */
  @Activity('하위 부서 트리 조회')
  @Get('sub/:deptId')
  async findSubTree(@Param('deptId') deptId: number) {
    return this.departmentService.findDepartmentSubTree(deptId);
  }

  /**
   * 부서 상세 조회'
   * @param deptId
   * @returns
   */
  @Activity('부서 상세 조회')
  @Get('id/:deptId')
  async findDepartment(
    @Param('deptId') deptId: number,
  ): Promise<DepartmentResponseDto> {
    return this.departmentService.findDepartment(deptId);
  }

  /**
   * 부서 생성
   * @param dto
   * @param user
   * @returns
   */
  @Permission('ORG_MGMT', 'CREATE')
  @Activity('부서 생성')
  @Post()
  async create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user,
  ): Promise<DepartmentResponseDto> {
    return this.departmentService.createDepartment(dto, user.sub);
  }

  /**
   * 부서 수정
   * @param deptId
   * @param dto
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'UPDATE')
  @Activity('부서 수정')
  @Patch(':deptId')
  async update(
    @Param('deptId') deptId: number,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: AuthorizedRequest,
  ): Promise<DepartmentResponseDto> {
    return this.departmentService.updateDepartment(deptId, dto, req);
  }

  /**
   * 부서 활성화/비활성화
   * @param deptId
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'DELETE')
  @Activity('부서 활성화/비활성화 토글')
  @Patch('toggle/:deptId')
  async toggleActive(
    @Param('deptId') deptId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<Department> {
    return this.departmentService.toggleActive(deptId, req);
  }

  /**
   * 부서 삭제
   * 실제 사용은 하지 않으나 일단 구현만 해 둔 상황
   * @param deptId
   * @param req
   * @returns
   */
  @Permission('ORG_MGMT', 'DELETE')
  @Activity('부서 삭제')
  @Delete(':deptId')
  async remove(
    @Param('deptId') deptId: number,
    @Req() req: AuthorizedRequest,
  ): Promise<{ message: string }> {
    await this.departmentService.hardDelete(deptId, req);
    return { message: 'Department successfully deleted' };
  }

  /**
   * 부서 검색
   * @param query
   * @returns
   */
  @Activity('부서 검색')
  @Get('search')
  async search(
    @Query() query: SearchDepartmentDto,
  ): Promise<DepartmentResponseDto[]> {
    return this.departmentService.search(query);
  }
}
