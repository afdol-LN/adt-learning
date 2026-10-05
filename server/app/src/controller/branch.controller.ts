import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateBranchForSelfDto,
  UpdateBranchExpForSelfDto,
  responseGetBranch,
} from 'src/dto/branch.dto';
import { responseBranchDashboard } from 'src/dto/branchDashboard.dto';
import { BranchSkillTreeDto } from 'src/dto/branchSkillTree.dto';
import { RecommendedSkillDto } from 'src/dto/exerciseAndSession/session.dto';
import { RestAPIResponse } from 'src/dto/RestAPI.dto';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { Branch } from 'src/entity/branch.entity';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { branchService } from 'src/service/branch.service';
import { historyService } from 'src/service/history.service';
import { sessionService } from 'src/service/session.service';
import { learningReportService } from 'src/service/learningReport.service';
import {
  responseBranchReport,
  responseSummaryReport,
} from 'src/dto/learningReport.dto';
import { BaseController } from './base.controller';

const failure = (error: unknown) => ({
  isError: true,
  data: null,
  errorMassege:
    error instanceof Error ? error.message : 'An unknown error occurred',
});

@ApiTags('Branch')
@Controller('/branch')
export class branchController extends BaseController<Branch> {
  constructor(
    private readonly branchService: branchService,
    private readonly historyService: historyService,
    private readonly sessionService: sessionService,
    private readonly learningReport: learningReportService,
  ) {
    super(branchService);
  }

  @Get('/user/:userId')
  @UseGuards(AdminMiddleware)
  async getUserBranches(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<responseGetBranch> {
    return await this.branchService.findAllForUser(userId);
  }

  // Separate route rather than overriding the inherited generic
  // `POST /branch` (BaseController.create) — userId always comes from the
  // authenticated request here, never the client, so one user can't create
  // a branch under another user's account.
  @Get('/mine')
  async getMyBranches(
    @Req() req: AuthenRequestDto,
  ): Promise<responseGetBranch> {
    return await this.branchService.findAllForUser(req.user!.userId);
  }

  @Post('/mine')
  async createForSelf(
    @Req() req: AuthenRequestDto,
    @Body() dto: CreateBranchForSelfDto,
  ): Promise<Branch> {
    return await this.branchService.create({
      userId: req.user!.userId,
      goalId: dto.goalId,
      expForGoal: dto.expForGoal,
    });
  }

  // Profile → Export PDF, every goal of the caller. Declared before /:branchId/* so "mine" is not
  // parsed as a branch id.
  @Get('/mine/report')
  async getMySummaryReport(
    @Req() req: AuthenRequestDto,
  ): Promise<responseSummaryReport> {
    try {
      const data = await this.learningReport.getSummaryReport(req.user!.userId);
      return { isError: false, data, errorMassege: null };
    } catch (error) {
      return failure(error);
    }
  }

  // Profile → Export PDF, one goal; the service checks the branch is the caller's
  @Get('/:branchId/report')
  async getBranchReport(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<responseBranchReport> {
    try {
      const data = await this.learningReport.getBranchReport(
        branchId,
        req.user!.userId,
      );
      return { isError: false, data, errorMassege: null };
    } catch (error) {
      return failure(error);
    }
  }

  // userId from the JWT, never the body — a student can only touch their own branch
  @Patch('/mine/:id')
  async updateMyBranchExp(
    @Req() req: AuthenRequestDto,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchExpForSelfDto,
  ): Promise<{ id: number; expForGoal: number }> {
    return await this.branchService.updateExpForSelf(
      req.user!.userId,
      id,
      Number(dto?.expForGoal),
    );
  }

  @Get('/:branchId/skills')
  async getBranchSkills(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<RestAPIResponse<BranchSkillTreeDto>> {
    try {
      const data = await this.historyService.getBranchSkills(
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

  @Get('/:branchId/stats')
  async getBranchStats(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<responseBranchDashboard> {
    try {
      const data = await this.historyService.getBranchStats(
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

  @Get('/:branchId/recommendation')
  async getRecommendation(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<RestAPIResponse<RecommendedSkillDto | null>> {
    try {
      const data = await this.sessionService.recommendNextSkill(
        branchId,
        req.user!.userId,
      );
      return { isError: false, data, errorMassege: null };
    } catch (error) {
      return {
        isError: true,
        data: null,
        errorMassege:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  @Get('/:branchId/baseState')
  async getBaseState(
    @Req() req: AuthenRequestDto,
    @Param('branchId', ParseIntPipe) branchId: number,
  ) {
    try {
      const data = await this.branchService.getPretestBreakdown(
        branchId,
        req.user!.userId,
      );
      return { isError: false, data, errorMassege: null };
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
