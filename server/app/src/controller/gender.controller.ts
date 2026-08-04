import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from './base.controller';
import { Gender } from 'src/entity/gender.entity';
import { genderService } from 'src/service/gender.service';

@ApiTags('Gender')
@Controller('/gender')
export class genderController extends BaseController<Gender> {
  constructor(private readonly genderService: genderService) {
    super(genderService);
  }
}
