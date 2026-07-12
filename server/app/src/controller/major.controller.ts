import { Controller } from '@nestjs/common';
import { Major } from 'src/entity/university/major.entity';
import { majorService } from 'src/service/major.service';
import { BaseController } from './base.controller';

@Controller('/major')
export class majorController extends BaseController<Major> {
  constructor(private readonly majorService: majorService) {
    super(majorService);
  }
}
