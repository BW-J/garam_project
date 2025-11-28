import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from 'src/core/entities/tb_bank.entity';
import { plainToInstance } from 'class-transformer';
import { BankResponseDto } from './dto/bank-response.dto';

@Injectable()
export class BankService {
  constructor(
    @InjectRepository(Bank)
    private readonly bankRepo: Repository<Bank>,
  ) {}

  async findAll(): Promise<BankResponseDto[]> {
    const banks = await this.bankRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', bankName: 'ASC' },
    });
    return plainToInstance(BankResponseDto, banks);
  }
}
