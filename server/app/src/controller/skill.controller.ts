import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateSkillWithPrerequisiteDto,
  UpdateSkillWithPrerequisiteDto,
} from 'src/dto/skill.dto';
import { Skill } from 'src/entity/skill.entity';
import { skillService } from 'src/service/skill.service';
import { BaseController } from './base.controller';

@ApiTags('Skill')
@Controller('/skill')
export class skillController extends BaseController<Skill> {
  constructor(private readonly skillService: skillService) {
    super(skillService);
  }

  @Post('/with-prerequisite')
  async createWithPrerequisite(
    @Body() dto: CreateSkillWithPrerequisiteDto,
  ): Promise<Skill> {
    return await this.skillService.createSkillWithPrerequisite(dto);
  }

  @Put(':id/with-prerequisite')
  async updateWithPrerequisite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSkillWithPrerequisiteDto,
  ): Promise<Skill> {
    return await this.skillService.updateSkillWithPrerequisite(id, dto);
  }
}
