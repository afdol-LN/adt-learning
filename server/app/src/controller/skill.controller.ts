import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateSkillWithPrerequisiteDto,
  UpdateSkillWithPrerequisiteDto,
} from 'src/dto/skill.dto';
import { Skill } from 'src/entity/skill.entity';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { skillService } from 'src/service/skill.service';
import { BaseController } from './base.controller';
import type { DeepPartial } from 'typeorm';

@ApiTags('Skill')
@Controller('/skill')
export class skillController extends BaseController<Skill> {
  constructor(private readonly skillService: skillService) {
    super(skillService);
  }

  // ── Admin-only: override BaseController generic CRUD with guards ──────────

  @Post()
  @UseGuards(AdminMiddleware)
  async create(@Body() data: DeepPartial<Skill>): Promise<Skill> {
    return await super.create(data);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Skill> {
    return await super.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminMiddleware)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: DeepPartial<Skill>,
  ): Promise<Skill> {
    return await super.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AdminMiddleware)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await super.remove(id);
  }

  // ── Admin-only: composite create / update with prerequisites ───────────────

  @Post('/with-prerequisite')
  @UseGuards(AdminMiddleware)
  async createWithPrerequisite(
    @Body() dto: CreateSkillWithPrerequisiteDto,
  ): Promise<Skill> {
    return await this.skillService.createSkillWithPrerequisite(dto);
  }

  @Put(':id/with-prerequisite')
  @UseGuards(AdminMiddleware)
  async updateWithPrerequisite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSkillWithPrerequisiteDto,
  ): Promise<Skill> {
    return await this.skillService.updateSkillWithPrerequisite(id, dto);
  }
}
