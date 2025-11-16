import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PositionRoleMap } from 'src/core/entities/tb_position_role_map.entity';
import { BaseService } from 'src/core/services/base.service';
import { Repository } from 'typeorm';
import { SetPositionRolesDto } from './dto/set-position-role.dto';
import { plainToInstance } from 'class-transformer';
import { AuthorizedRequest } from 'src/types/http';

@Injectable()
export class PositionRoleMapService {
  constructor(
    @InjectRepository(PositionRoleMap)
    private readonly positionRoleMapRepository: Repository<PositionRoleMap>,
  ) {}

  async getRolesByPosition(positionId: number) {
    const result = await this.positionRoleMapRepository.find({
      where: { positionId: positionId },
      relations: ['role'],
      order: { positionId: 'ASC' },
    });
    return plainToInstance(SetPositionRolesDto, result);
  }

  async setPositionRoles(
    positionId: number,
    roleIds: number[],
    req?: AuthorizedRequest,
  ) {
    const result = await this.positionRoleMapRepository.manager.transaction(
      async (manager) => {
        // 1. 삭제 (트랜잭션 매니저 사용)
        await manager.delete(PositionRoleMap, { positionId: { positionId } });

        // 2. 생성 (super.create 대신 직접 manager.save 사용 또는 super.create 수정).
        const newPositionRoles = roleIds.map((roleId) =>
          this.positionRoleMapRepository.create({
            roleId,
            positionId,
            createdBy: req?.user?.sub,
            updatedBy: req?.user?.sub,
          }),
        );
        return await manager.save(PositionRoleMap, newPositionRoles);
      },
    );

    return plainToInstance(SetPositionRolesDto, result);
  }
}
