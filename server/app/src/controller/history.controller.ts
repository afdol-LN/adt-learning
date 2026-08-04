import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
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
        errorMassege: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
