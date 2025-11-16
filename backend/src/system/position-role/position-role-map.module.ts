import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionRoleMap } from 'src/core/entities/tb_position_role_map.entity';
import { PositionRoleMapService } from './position-role-map.service';
import { PositionRoleMapController } from './position-role-map.controller';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([PositionRoleMap]), RoleModule],
  providers: [PositionRoleMapService],
  controllers: [PositionRoleMapController],
  exports: [PositionRoleMapService],
})
export class PositionRoleMapModule {}
