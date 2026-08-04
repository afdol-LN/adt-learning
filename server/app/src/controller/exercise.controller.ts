import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateExerciseDto,
  UpdateExerciseDto,
} from 'src/dto/exerciseAndSession/exercise.dto';
import { PretestSubmitDto } from 'src/dto/exerciseAndSession/pretestSubmit.dto';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { exerciseService } from 'src/service/exercise.service';
import { BaseController } from './base.controller';
import { UseGuards } from '@nestjs/common';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';

@ApiTags('Exercise')
@Controller('/exercise')
export class exerciseController extends BaseController<Exercise> {
  constructor(private readonly exerciseService: exerciseService) {
    super(exerciseService);
  }

  @Post('/pretest')
  async getPretestWithBody(
    @Body()
    body: {
      userId?: number ;
      goalId?: number ;
      branchId?: string;
      level?: number;
    },
  ) {
    Logger.log(
      `[exerciseController] /pretest POST request body: ${JSON.stringify(body)}`,
    ); 
    const targetGoalId = body?.goalId ?? body?.branchId;
    return await this.exerciseService.findPretestByGoal(
      targetGoalId,
      body?.userId,
      body?.level,
    );
  }

  @Post('/pretest/submit')
  async submitPretest(
    @Req() req: AuthenRequestDto,
    @Body() dto: PretestSubmitDto,
  ) {
    Logger.log(
      `[exerciseController] /pretest/submit POST request body: ${JSON.stringify(dto)}`,
    );
    await this.exerciseService.submitPretest(req.user!.userId, dto);
    return { success: true };
  }

  @Get('/pretest/:goalId')
  async getPretestByGoalParam(
    @Param('goalId') goalId: string,
    @Query('userId') userId?: string,
    @Query('level') level?: number,
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
