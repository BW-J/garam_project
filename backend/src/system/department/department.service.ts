import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Department } from 'src/core/entities/tb_department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { SearchDepartmentDto } from './dto/search-department.dto';
import { BaseService } from 'src/core/services/base.service';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { plainToInstance } from 'class-transformer';
import { AuthorizedRequest } from 'src/types/http';
import { UserService } from '../user/user.service';

@Injectable()
export class DepartmentService extends BaseService<Department> {
  constructor(
    @InjectRepository(Department)
    private readonly deptRepository: Repository<Department>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super(deptRepository);
  }

  /**
   * 부서 생성
   * @param dto
   * @param currentUserId
   * @returns
   */
  async createDepartment(dto: CreateDepartmentDto, user: number) {
    await this.validateDepartment(
      null,
      dto.parentDeptId,
      dto.deptCd,
      dto.deptNm,
    );
    const entity = this.deptRepository.create(dto);
    const result = await super.create(entity, user);
    return plainToInstance(DepartmentResponseDto, result);
  }

  /**
   * 부서 수정
   * @param deptId
   * @param dto
   * @param req
   * @returns
   */
  async updateDepartment(
    deptId: number,
    dto: UpdateDepartmentDto,
    req?: AuthorizedRequest,
  ) {
    await this.validateDepartment(
      dto.deptId,
      dto.parentDeptId,
      dto.deptCd,
      dto.deptNm,
    );

    const result = await super.updateForKey('deptId', deptId, dto, req);
    return plainToInstance(DepartmentResponseDto, result);
  }

  /**
   * 부서 전체 트리를 계층적 구조로 조회
   * @returns 중첩된 배열 형태의 부서 트리 (Tree Grid가 요구하는 형식)
   */
  async findFullDepartmentTree(): Promise<DepartmentResponseDto[]> {
    const data = await this.findAll();
    const result = this.buildTree(data, 'deptId', 'parentDeptId', 'deptNm');
    return plainToInstance(DepartmentResponseDto, result);
  }

  /**
   * 특정 부서 하위트리 조회
   * @param deptId
   * @returns
   */
  async findDepartmentSubTree(deptId: number): Promise<DepartmentResponseDto> {
    const data = await this.findAll();

    const subTree = await this.buildSubTree(
      data,
      'deptId',
      'parentDeptId',
      deptId,
      'deptNm',
    );

    if (!subTree) {
      throw new NotFoundException(`부서를 찾을 수 없습니다.`);
    }

    return plainToInstance(DepartmentResponseDto, subTree); // 반환 값은 기준 부서(parentDepartment) 객체이며, 그 안에 children 속성으로 하위 트리가 중첩됩니다.
  }

  /**
   * 부서 목록 조회
   * 임시 혹시 몰라 남겨 둠
   * @returns
   */
  async findAllDepartment(): Promise<DepartmentResponseDto[]> {
    const result = await this.deptRepository.find({
      order: { sortOrder: 'ASC', deptNm: 'ASC' },
      relations: ['parent'],
    });
    return plainToInstance(DepartmentResponseDto, result);
  }

  /**
   * 부서 단건 조회
   */
  async findDepartment(deptId: number) {
    const department = await this.deptRepository.findOne({
      where: { deptId: deptId, isActive: true },
    });
    if (!department) throw new NotFoundException('부서를 찾을 수 없습니다.');
    return plainToInstance(DepartmentResponseDto, department);
  }

  /**
   * 부서 검색 (다중 조건)
   * 임시 혹시 몰라 남겨 둠
   */
  async search(params: SearchDepartmentDto): Promise<DepartmentResponseDto[]> {
    const query = this.deptRepository.createQueryBuilder('dept');

    if (params.deptCd) {
      query.andWhere('dept.dept_cd ILIKE :deptCd', {
        deptCd: `%${params.deptCd}%`,
      });
    }

    if (params.deptNm) {
      query.andWhere('dept.dept_nm ILIKE :deptNm', {
        deptNm: `%${params.deptNm}%`,
      });
    }

    if (params.isActive !== undefined) {
      query.andWhere('dept.is_active = :isActive', {
        isActive: params.isActive,
      });
    }

    query.leftJoinAndSelect('dept.parentDept', 'parent');
    query.orderBy('dept.sort_order', 'ASC').addOrderBy('dept.dept_id', 'ASC');

    return query.getMany();
  }

  /**
   * 부서 비활성화
   * @param deptId
   * @param req
   * @returns
   */
  async toggleActive(deptId: number, req?: AuthorizedRequest) {
    const before = await this.deptRepository.findOne({
      where: { deptId },
      relations: ['children'],
    });

    if (!before) {
      throw new NotFoundException(`부서를 찾을 수 없습니다.`);
    }

    if (before.isActive) {
      if (before.children.length > 0) {
        throw new BadRequestException(
          '하위 부서가 존재하여 삭제할 수 없습니다. 하위 부서를 먼저 처리해 주세요.',
        );
      }
      // 하위 '활성 사용자'가 있는지 검사
      const activeUserCount =
        await this.userService.countActiveUsersByDeptId(deptId);
      if (activeUserCount > 0) {
        throw new BadRequestException(
          `활성 사용자가 ${activeUserCount}명 소속되어 있어 비활성화할 수 없습니다.`,
        );
      }
    }

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.deptRepository.save(before);
    this.logger.debug(
      `The activation status of ${this.deptRepository.metadata.name} ID $${deptId} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  /**
   * 부서 벨리데이션
   * @param name
   * @param parentDeptId
   * @param excludeId
   */
  private async validateDepartment(
    deptId: number | null,
    parentDeptId: number | null,
    deptCd: string | null,
    deptNm: string,
  ) {
    // 1. 상위 부서 활성 상태 및 유효성 체크
    if (parentDeptId !== null) {
      const parent = await this.deptRepository.findOne({
        where: { deptId: parentDeptId },
        select: ['deptId', 'isActive'], // 필요한 필드만 조회
      });

      if (!parent) {
        throw new BadRequestException(
          '지정한 상위 부서 ID가 존재하지 않습니다.',
        );
      }
      if (!parent.isActive) {
        throw new BadRequestException(
          '상위 부서가 비활성 상태이므로 하위 부서를 만들 수 없습니다.',
        );
      }
    }

    // 2. deptCode 중복 체크 (자신 제외)
    const codeWhere: any = { deptCd: deptCd };
    if (deptId !== null) {
      codeWhere.deptId = Not(deptId); // 수정 시: 자신을 제외
    }

    const codeExists = await this.deptRepository.exist({ where: codeWhere });
    if (codeExists) {
      throw new ConflictException(`부서 코드(${deptCd})가 이미 사용 중입니다.`);
    }

    // 3. 같은 상위 부서 하에 이름 중복 체크 (자신 제외)
    const nameWhere: any = {
      deptNm: deptNm,
      parentDeptId: parentDeptId,
    };
    if (deptId !== null) {
      nameWhere.deptId = Not(deptId); // 수정 시: 자신을 제외
    }

    const nameExists = await this.deptRepository.exist({ where: nameWhere });
    if (nameExists) {
      throw new ConflictException(
        `상위 부서 ID ${parentDeptId || 'NULL'} 하에 같은 이름의 부서가 이미 존재합니다.`,
      );
    }

    // 4. [수정 시에만] 순환 참조 체크
    if (deptId !== null && parentDeptId === deptId) {
      throw new BadRequestException('상위 부서는 자기 자신일 수 없습니다.');
    }
  }
}
