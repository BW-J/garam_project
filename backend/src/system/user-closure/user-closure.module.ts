import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserClosure } from 'src/core/entities/tb_user_closure.entity';
import { UserClosureService } from './user-closure.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserClosure])],
  providers: [UserClosureService],
  exports: [UserClosureService], // UserService에서 주입받아 사용할 수 있도록
})
export class UserClosureModule {}
