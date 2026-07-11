import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Major } from 'src/entity/university/major.entity';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';

@Injectable()
export class majorService extends BaseService<Major> {
  constructor(
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
  ) {
    super(majorRepository);
  }
}
