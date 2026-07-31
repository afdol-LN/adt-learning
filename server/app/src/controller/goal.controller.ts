import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateGoalWithSkillRequireDto,
  UpdateGoalWithSkillRequireDto,
} from 'src/dto/goal.dto';
import { Goal } from 'src/entity/goal.entity';
import { goalService } from 'src/service/goal.service';
import { BaseController } from './base.controller';

@Controller('/goal')
export class goalController extends BaseController<Goal> {
  constructor(private readonly goalService: goalService) {
    super(goalService);
  }

  @Post('/with-skill-require')
  async createWithSkillRequire(
    @Body() dto: CreateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.createGoalWithSkillRequire(dto);
  }

  @Put(':id/with-skill-require')
  async updateWithSkillRequire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.updateGoalWithSkillRequire(id, dto);
  }
}
