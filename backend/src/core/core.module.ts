import { Module } from '@nestjs/common';
import { CoreService } from './core.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/tb_department.entity';
import { Action } from './entities/tb_action.entity';
import { Menu } from './entities/tb_menu.entity';
import { Position } from './entities/tb_position.entity';
import { PositionRoleMap } from './entities/tb_position_role_map.entity';
import { Role } from './entities/tb_role.entity';
import { RolePermissions } from './entities/tb_role_permissions.entity';
import { UserRoleMap } from './entities/tb_user_role_map.entity';
import { User } from './entities/tb_user.entity';
import { CommissionLedger } from './entities/tb_commission_ledger.entity';
import { PerformanceData } from './entities/tb_performance_data.entity';
import { Attachment } from './entities/tb_attachment.entity';
import { Board } from './entities/tb_board.entity';
import { UserPositionHistory } from './entities/tb_user_position_history.entity';
import { Bank } from './entities/tb_bank.entity';
import { PerformanceDetail } from './entities/tb_performance_detail.entity';
import { Performance } from './entities/tb_performance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PositionRoleMap,
      UserRoleMap,
      Role,
      Position,
      RolePermissions,
      Menu,
      Action,
      Department,
      User,
      PerformanceData,
      PerformanceDetail,
      Performance,
      CommissionLedger,
      Board,
      Attachment,
      UserPositionHistory,
      Bank,
    ]),
  ],
  providers: [CoreService],
  exports: [TypeOrmModule],
})
export class CoreModule {}
