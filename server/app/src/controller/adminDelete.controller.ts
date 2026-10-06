import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { adminDeleteService, DeleteBlockedError } from 'src/service/adminDelete.service';

/**
 * Admin hard delete of goals / skills / exercises / users that no learner has used yet.
 * The older DELETE /goal/:id etc. only deactivate — these really remove the row.
 * A refused delete answers isError with data.code (see DeleteBlockedError) so the UI can
 * explain why and point to "deactivate" instead. Admin-only (class-level guard).
 */
@ApiTags('AdminDelete')
@UseGuards(AdminMiddleware)
@Controller('/admin')
export class adminDeleteController {
  constructor(private readonly deleteService: adminDeleteService) {}

  private async run(action: () => Promise<void>) {
    try {
      await action();
      return { isError: false, data: null, errorMessage: '' };
    } catch (error: any) {
      if (error instanceof DeleteBlockedError) {
        return {
          isError: true,
          data: { code: error.code, ...error.detail },
          errorMessage: error.code,
        };
      }
      return { isError: true, data: null, errorMessage: error.message };
    }
  }

  @Delete('/exercises/:id')
  deleteExercise(@Param('id', ParseIntPipe) id: number) {
    return this.run(() => this.deleteService.deleteExercise(id));
  }

  @Delete('/skills/:id')
  deleteSkill(@Param('id', ParseIntPipe) id: number) {
    return this.run(() => this.deleteService.deleteSkill(id));
  }

  @Delete('/goals/:id')
  deleteGoal(@Param('id', ParseIntPipe) id: number) {
    return this.run(() => this.deleteService.deleteGoal(id));
  }

  @Delete('/users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenRequestDto) {
    return this.run(() => this.deleteService.deleteUser(id, req.user!.userId));
  }
}
