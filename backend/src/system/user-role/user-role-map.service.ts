import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserRoleMap } from 'src/core/entities/tb_user_role_map.entity';
import { BaseService } from 'src/core/services/base.service';
import { SetUserRolesDto } from './dto/set-user-role.dto';
import { plainToInstance } from 'class-transformer';
import { AuthorizedRequest } from 'src/types/http';

@Injectable()
export class UserRoleMapService {
  constructor(
    @InjectRepository(UserRoleMap)
    private readonly userRoleMapRepository: Repository<UserRoleMap>,
  ) {}

  async getRolesByUser(userId: number) {
    const result = await this.userRoleMapRepository.find({
      where: { userId: userId },
      relations: ['role'],
      order: { roleId: 'ASC' },
    });
    return plainToInstance(SetUserRolesDto, result);
  }

  async setUserRoles(
    userId: number,
    roleIds: number[],
    req?: AuthorizedRequest,
  ) {
    const before = await this.getRolesByUser(userId);
    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    const result = await this.userRoleMapRepository.manager.transaction(
      async (manager) => {
        // 1. 삭제 (트랜잭션 매니저 사용)
        await manager.delete(UserRoleMap, { userId: { userId } });

        // 2. 생성 (super.create 대신 직접 manager.save 사용 또는 super.create 수정).
        const newUserRoles = roleIds.map((roleId) =>
          this.userRoleMapRepository.create({
            roleId,
            userId,
            createdBy: req?.user?.sub,
            updatedBy: req?.user?.sub,
          }),
        );
        return await manager.save(UserRoleMap, newUserRoles);
      },
    );

    return plainToInstance(SetUserRolesDto, result);
  }
}
