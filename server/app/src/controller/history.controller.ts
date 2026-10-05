import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from './base.controller';
import { History } from 'src/entity/history.entity';
import { historyService } from 'src/service/history.service';
import { responseSessionHistory } from 'src/dto/historyResponse.dto';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';

@ApiTags('History')
@Controller('/history')
export class historyController extends BaseController<History> {
  constructor(private readonly historyService: historyService) {
    super(historyService);
  }

  // admin History tab: one session's answers, same shape as a student's history card
  @UseGuards(AdminMiddleware)
  @Get('/admin/session/:sessionId')
  async getSessionDetail(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    try {
      const data = await this.historyService.getSessionDetail(sessionId);
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }

  @Get('/branch/:branchId/sessions')
  async getSessions(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<responseSessionHistory> {
    try {
      const data = await this.historyService.getSessionsForBranch(
        branchId,
        req.user!.userId,
      );
      return {
        isError: false,
        data,
        errorMassege: null,
      };
    } catch (error) {
      return {
        isError: true,
        data: null,
        errorMassege:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
