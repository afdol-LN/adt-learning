import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { learnerStatsService } from 'src/service/learnerStats.service';

/**
 * Admin: who picked a goal / who practised a skill, with their progress (Goal and Skill detail
 * modals' stats tab). Admin-only (class-level guard). Do NOT add these paths to the exclude()
 * list of AuthMiddleWare in app.module.ts — AdminMiddleware reads req.user that it sets.
 */
@ApiTags('LearnerStats')
@UseGuards(AdminMiddleware)
@Controller('/admin')
export class learnerStatsController {
  constructor(private readonly statsService: learnerStatsService) {}

  @Get('/goal-stats/:goalId')
  async getGoalLearners(@Param('goalId', ParseIntPipe) goalId: number) {
    try {
      const data = await this.statsService.getGoalLearners(goalId);
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }

  @Get('/skill-stats/:skillId')
  async getSkillLearners(@Param('skillId', ParseIntPipe) skillId: number) {
    try {
      const data = await this.statsService.getSkillLearners(skillId);
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }
}
