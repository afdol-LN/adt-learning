import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateBranchForSelfDto,
  UpdateBranchExpForSelfDto,
  responseGetBranch,
} from 'src/dto/branch.dto';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { Branch } from 'src/entity/branch.entity';
import { branchService } from 'src/service/branch.service';
import { historyService } from 'src/service/history.service';
import { responseBranchDashboard } from 'src/dto/branchDashboard.dto';
import { RestAPIResponse } from 'src/dto/RestAPI.dto';
import { BaseController } from './base.controller';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { sessionService } from 'src/service/session.service';
import { RecommendedSkillDto } from 'src/dto/exerciseAndSession/session.dto';
import { BranchSkillTreeDto } from 'src/dto/branchSkillTree.dto';

@ApiTags('Branch')
@Controller('/branch')
export class branchController extends BaseController<Branch> {
  constructor(
    private readonly branchService: branchService,
    private readonly historyService: historyService,
    private readonly sessionService: sessionService,
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
}
