import { Controller, Get } from '@nestjs/common';
import { Goal } from 'src/entity/goal.entity';
import { goalService } from 'src/service/goal.service';
import { BaseController } from './base.controller';

@Controller('/goal')
export class goalController extends BaseController<Goal> {
  constructor(private readonly goalService: goalService) {
    super(goalService);
  }

  @Get()
  async getAllGoals(): Promise<Goal[]> {
    return await this.goalService.findAll();
  }
}
