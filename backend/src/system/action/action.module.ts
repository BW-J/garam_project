import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from 'src/core/entities/tb_action.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Action])],
  controllers: [ActionController],
  providers: [ActionService],
  exports: [ActionService, TypeOrmModule],
})
export class ActionModule {}
