import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { exerciseStatsService } from 'src/service/exerciseStats.service';

/**
 * Admin/teacher "ประวัติการทำโจทย์": per-question statistics.
 * Admin-only (class-level guard). Do NOT add this path to the exclude() list of AuthMiddleWare in
 * app.module.ts — AdminMiddleware reads req.user that AuthMiddleWare sets.
 */
@ApiTags('ExerciseStats')
@UseGuards(AdminMiddleware)
@Controller('/admin/exercise-stats')
export class exerciseStatsController {
  constructor(private readonly statsService: exerciseStatsService) {}

  @Get()
  async getList(
    @Query('skillId') skillId?: string,
    @Query('includePretest') includePretest?: string,
  ) {
    try {
      const sid =
        skillId !== undefined && skillId !== '' && !isNaN(Number(skillId))
          ? Number(skillId)
          : undefined;
      const data = await this.statsService.getList(
        sid,
        includePretest === 'true',
      );
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }

  @Get('/:exerciseId')
  async getDetail(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Query('includePretest') includePretest?: string,
  ) {
    try {
      const data = await this.statsService.getDetail(
        exerciseId,
        includePretest === 'true',
      );
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }
}
