import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Faculty } from 'src/entity/university/faculty.entity';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';

@Injectable()
export class facultyService extends BaseService<Faculty> {
  constructor(
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
  ) {
    super(facultyRepository);
  }
}
