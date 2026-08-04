import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Faculty } from 'src/entity/university/faculty.entity';
import { facultyService } from 'src/service/faculty.service';
import { BaseController } from './base.controller';

@ApiTags('Faculty')
@Controller('/faculty')
export class facultyController extends BaseController<Faculty> {
  constructor(private readonly facultyService: facultyService) {
    super(facultyService);
  }

  @Get('/Bycampus/:campusId')
  async getFacultyBycampus(@Param('campusId') campusId: number) {
    return await this.facultyService.getFacultyByCampus(campusId);
  }
}
