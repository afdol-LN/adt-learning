import { Controller } from '@nestjs/common';
import { Campus } from 'src/entity/university/campus.entity';
import { campusService } from 'src/service/campus.service';
import { BaseController } from './base.controller';
@Controller('/campus')
export class campusController extends BaseController<Campus> {
  constructor(private readonly campusService: campusService) {
    super(campusService);
  }
}
