import { forwardRef, Module } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from 'src/core/entities/tb_position.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Position]), forwardRef(() => UserModule)],
  controllers: [PositionController],
  providers: [PositionService],
})
export class PositionModule {}
