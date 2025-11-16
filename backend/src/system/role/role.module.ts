import { forwardRef, Global, Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/core/entities/tb_role.entity';
import { RoleController } from './role.controller';
import { RolePermissionsService } from './role-permission.service';
import { RolePermissions } from 'src/core/entities/tb_role_permissions.entity';
import { RolePermissionsController } from './role-permissions.controller';
import { UserModule } from '../user/user.module';
import { MenuModule } from '../menu/menu.module';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, RolePermissions]),

    forwardRef(() => UserModule),
    MenuModule,
    ActionModule,
  ],
  controllers: [RoleController, RolePermissionsController],
  providers: [RoleService, RolePermissionsService],
  exports: [RolePermissionsService],
})
export class RoleModule {}
