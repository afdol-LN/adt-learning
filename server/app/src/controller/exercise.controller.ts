import { Controller, Logger, Get, Param, Query } from '@nestjs/common';
import { exerciseService } from 'src/service/exercise.service';
import { BaseController } from './base.controller';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Post } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { CreateExerciseDto } from 'src/dto/exerciseAndSession/exercise.dto';
import { CreateExerciseChoiceDto } from 'src/dto/exerciseAndSession/exerciseChoice.dto';

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

  @Post('/create_exercise_choice')
  async createExercise(
    @Body('exercise') exercise: CreateExerciseDto,
    @Body('exerciseChoices') exerciseChoices: CreateExerciseChoiceDto[],
  ) {
    const result = await this.exerciseService.createExercise(exercise, exerciseChoices);
    return result;
  }
}
