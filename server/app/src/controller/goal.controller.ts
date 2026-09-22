import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateGoalWithSkillRequireDto,
  UpdateGoalWithSkillRequireDto,
} from 'src/dto/goal.dto';
import {
  GoalWorkspaceDto,
  PublishGoalResultDto,
} from 'src/dto/goalWorkspace.dto';
import { Goal } from 'src/entity/goal.entity';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { goalService } from 'src/service/goal.service';
import { goalWorkspaceService } from 'src/service/goalWorkspace.service';
import { BaseController } from './base.controller';
import type { DeepPartial } from 'typeorm';

@ApiTags('Goal')
@Controller('/goal')
export class goalController extends BaseController<Goal> {
  constructor(
    private readonly goalService: goalService,
    private readonly goalWorkspaceService: goalWorkspaceService,
  ) {
    super(goalService);
  }

  // Overrides BaseController.findAll — student-facing callers keep getting
  // active-only goals by default; the admin panel opts into seeing inactive
  // ones via ?includeInactive=true.
  @Get()
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<Goal[]> {
    if (includeInactive === 'true') {
      return await this.goalService.findAllIncludingInactive();
    }
    return await this.goalService.findAll();
  }

  // ── Admin-only: override BaseController generic CRUD with guards ──────────

  @Post()
  @UseGuards(AdminMiddleware)
  async create(@Body() data: DeepPartial<Goal>): Promise<Goal> {
    return await super.create(data);
  }

  @Put(':id')
  @UseGuards(AdminMiddleware)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: DeepPartial<Goal>,
  ): Promise<Goal> {
    return await super.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AdminMiddleware)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await super.remove(id);
  }

  // ── Admin-only: composite create / update with skill-require ───────────────

  @Post('/with-skill-require')
  @UseGuards(AdminMiddleware)
  async createWithSkillRequire(
    @Body() dto: CreateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.createGoalWithSkillRequire(dto);
  }

  @Put(':id/with-skill-require')
  @UseGuards(AdminMiddleware)
  async updateWithSkillRequire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.updateGoalWithSkillRequire(id, dto);
  }

  /**
   * ข้อมูลทั้งหน้าของ Goal Workspace ในคำขอเดียว
   * admin เท่านั้น — guard ใส่ต่อ route เพื่อไม่เปลี่ยนสิทธิ์ของ CRUD ที่สืบทอดมา
   * (route นี้อยู่ใต้ AuthMiddleWare อยู่แล้ว เพราะไม่ได้ถูก exclude)
   */
  @Get(':id/workspace')
  @UseGuards(AdminMiddleware)
  async getWorkspace(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GoalWorkspaceDto> {
    return await this.goalWorkspaceService.getWorkspace(id);
  }

  /** เปิดใช้งาน goal + skill ใน closure ที่ยังปิดอยู่ (ตรวจความพร้อมใหม่ที่ server) */
  @Post(':id/publish')
  @UseGuards(AdminMiddleware)
  async publish(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublishGoalResultDto> {
    return await this.goalWorkspaceService.publish(id);
  }
}
