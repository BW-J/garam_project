import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRoleMap } from 'src/core/entities/tb_user_role_map.entity';
import { UserRoleMapService } from './user-role-map.service';
import { UserRoleMapController } from './user-role-map.controller';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleMap]), RoleModule],
  providers: [UserRoleMapService],
  controllers: [UserRoleMapController],
  exports: [UserRoleMapService],
})
export class UserRoleMapModule {}
