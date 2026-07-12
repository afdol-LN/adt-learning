import { Controller } from '@nestjs/common';
import { Faculty } from 'src/entity/university/faculty.entity';
import { facultyService } from 'src/service/faculty.service';
import { BaseController } from './base.controller';

@Controller('/faculty')
export class facultyController extends BaseController<Faculty> {
  constructor(private readonly facultyService: facultyService) {
    super(facultyService);
  }
}
