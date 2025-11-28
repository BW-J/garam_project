import { Controller, Get } from '@nestjs/common';
import { BankService } from './bank.service';
import { Activity } from 'src/common/decorators/activity.decorator';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('system/bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Public() // 로그인한 누구나 조회 가능 (또는 권한 필요시 제거)
  @Activity('은행 목록 조회')
  @Get()
  async findAll() {
    return this.bankService.findAll();
  }
}
