import { Controller } from '@nestjs/common';
import { BaseController } from './base.controller';
import { Gender } from 'src/entity/gender.entity';
import { genderService } from 'src/service/gender.service';

@Controller('/gender')
export class genderController extends BaseController<Gender> {
  constructor(private readonly genderService: genderService) {
    super(genderService);
  }
}
