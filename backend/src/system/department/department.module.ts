import { forwardRef, Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from 'src/core/entities/tb_department.entity';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department]),
    RoleModule,
    forwardRef(() => UserModule),
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService, TypeOrmModule],
})
export class DepartmentModule {}
