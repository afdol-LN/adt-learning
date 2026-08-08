import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Major } from 'src/entity/university/major.entity';
import { majorService } from 'src/service/major.service';
import { BaseController } from './base.controller';

@ApiTags('Major')
@Controller('/major')
export class majorController extends BaseController<Major> {
  constructor(private readonly majorService: majorService) {
    super(majorService);
  }

  @Get('/facultyId/:facultyId')
  async getMajorByFacultyId(@Param('facultyId') facultyId: number) {
    return await this.majorService.getMajorByFaculty(facultyId);
  }

  @Get('/Byfaculty/:facultyId')
  async getMajorByFacultyAlias(@Param('facultyId') facultyId: number) {
    return await this.majorService.getMajorByFaculty(facultyId);
  }
}
