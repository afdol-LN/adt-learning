import { Controller, Logger, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { exerciseService } from 'src/service/exercise.service';
import { BaseController } from './base.controller';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Post, Put } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { CreateExerciseDto, UpdateExerciseDto } from 'src/dto/exerciseAndSession/exercise.dto';

@Controller('/exercise')
export class exerciseController extends BaseController<Exercise> {
  constructor(private readonly exerciseService: exerciseService) {
    super(exerciseService);
  }

  @Post('/pretest')
  async getPretestWithBody(
    @Body() body: { userId?: number | string; goalId?: number | string; branchId?: string; level?: number }
  ) {
    Logger.log(`[exerciseController] /pretest POST request body: ${JSON.stringify(body)}`);
    const targetGoalId = body?.goalId ?? body?.branchId;
    return await this.exerciseService.findPretestByGoal(targetGoalId, body?.userId, body?.level);
  }

  @Get('/pretest/:goalId')
  async getPretestByGoalParam(
    @Param('goalId') goalId: string,
    @Query('userId') userId?: string,
    @Query('level') level?: number
  ) {
    Logger.log(`[exerciseController] /pretest GET param goalId: ${goalId}`);
    return await this.exerciseService.findPretestByGoal(goalId, userId, level);
  }

  @Post()
  async create(@Body() dto: CreateExerciseDto): Promise<Exercise> {
    return await this.exerciseService.createExercise(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ): Promise<Exercise> {
    return await this.exerciseService.updateExercise(id, dto);
  }
}
