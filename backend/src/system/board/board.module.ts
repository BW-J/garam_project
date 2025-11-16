import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { Board } from 'src/core/entities/tb_board.entity';
import { Attachment } from 'src/core/entities/tb_attachment.entity';
import { CommonUtilsModule } from 'src/common/common-utils.module';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Board, Attachment]),
    CommonUtilsModule, // FileService 사용을 위해 필요
    RoleModule,
  ],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
