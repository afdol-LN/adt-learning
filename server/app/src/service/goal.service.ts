import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Status } from 'src/enums/status.enum';
import {
  CreateGoalWithSkillRequireDto,
  GoalSkillRequireItemDto,
  UpdateGoalWithSkillRequireDto,
} from 'src/dto/goal.dto';

const GOAL_RELATIONS = {
  goalSkillRequire: { skill: { skillPrequisite: { prerequisiteSkill: true } } },
};

@Injectable()
export class goalService extends BaseService<Goal> {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(goalRepository);
  }

  async findAll(): Promise<Goal[]> {
    return this.goalRepository.find({
      where: {
        status: 'active',
      },
      relations: GOAL_RELATIONS,
    });
  }

  // Used by the admin Goal management page, which needs to see and toggle
  // inactive goals too — student-facing routes must keep using findAll()
  // above so inactive goals never surface there.
  async findAllIncludingInactive(): Promise<Goal[]> {
    return this.goalRepository.find({
      relations: GOAL_RELATIONS,
    });
  }

  async findOne(id: number): Promise<Goal> {
    const result = await this.goalRepository.findOne({
      where: { id },
      relations: GOAL_RELATIONS,
    });
    if (!result) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return result;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    existing.status = Status.INACTIVE;
    await this.goalRepository.save(existing);
  }

  async createGoalWithSkillRequire(
    dto: CreateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    const { skillRequires, ...goalData } = dto;

    if (!goalData.goal || goalData.goal.trim() === '') {
      throw new BadRequestException('Goal name is required');
    }

    if (skillRequires && skillRequires.length > 0) {
      const skillIds = skillRequires.map((s) => s.skillId);
      const hasDuplicates = skillIds.some(
        (id, index) => skillIds.indexOf(id) !== index,
      );
      if (hasDuplicates) {
        throw new BadRequestException(
          'Duplicate skillId in skillRequires is not allowed',
        );
      }
    }

    const goal = await this.dataSource.transaction(async (manager) => {
      const goalRepo = manager.getRepository(Goal);
      const requireRepo = manager.getRepository(GoalSkillRequire);

      const newGoal = await goalRepo.save(goalRepo.create(goalData));

      await this.validateSkillRequires(manager, skillRequires);

      const requireRows = skillRequires.map((s) =>
        requireRepo.create({
          goalId: newGoal.id,
          skillId: s.skillId,
          levelRequire: s.levelRequire,
        }),
      );
      await requireRepo.save(requireRows);

      return newGoal;
    });

    return this.findOne(goal.id);
  }

  async updateGoalWithSkillRequire(
    id: number,
    dto: UpdateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    const { skillRequires, ...goalData } = dto;

    const existingGoal = await this.findOne(id); // throws NotFoundException if missing

    if (goalData.goal !== undefined && goalData.goal.trim() === '') {
      throw new BadRequestException('Goal name is required');
    }

    if (skillRequires && skillRequires.length > 0) {
      const skillIds = skillRequires.map((s) => s.skillId);
      const hasDuplicates = skillIds.some(
        (id, index) => skillIds.indexOf(id) !== index,
      );
      if (hasDuplicates) {
        throw new BadRequestException(
          'Duplicate skillId in skillRequires is not allowed',
        );
      }
    }

    const existingSkillIds = new Set(
      (existingGoal.goalSkillRequire ?? []).map((r) => r.skillId),
    );

    await this.dataSource.transaction(async (manager) => {
      const goalRepo = manager.getRepository(Goal);
      const requireRepo = manager.getRepository(GoalSkillRequire);

      if (skillRequires) {
        // Only newly-added skill requirements need to pass the active-status
        // check. Skill IDs already associated with this goal before the edit
        // are allowed through even if they've since become inactive -
        // otherwise an admin could never save any edit to a goal once one of
        // its required skills is deactivated (full-replace resend lockout).
        const newSkillRequires = skillRequires.filter(
          (s) => !existingSkillIds.has(s.skillId),
        );
        await this.validateSkillRequires(manager, newSkillRequires);
      }

      if (Object.keys(goalData).length > 0) {
        await goalRepo.update({ id }, goalData);
      }

      if (skillRequires) {
        await requireRepo.delete({ goalId: id });
        const requireRows = skillRequires.map((s) =>
          requireRepo.create({
            goalId: id,
            skillId: s.skillId,
            levelRequire: s.levelRequire,
          }),
        );
        await requireRepo.save(requireRows);
      }
    });

    return this.findOne(id);
  }

  private async validateSkillRequires(
    manager: EntityManager,
    skillRequires: GoalSkillRequireItemDto[],
  ): Promise<void> {
    const skillRepo = manager.getRepository(Skill);
    for (const s of skillRequires) {
      const found = await skillRepo.findOne({ where: { skillId: s.skillId } });
      if (!found) {
        throw new BadRequestException(`Skill ${s.skillId} does not exist`);
      }
      if (found.status !== Status.ACTIVE) {
        throw new BadRequestException(`Skill ${s.skillId} is not active`);
      }
    }
  }
}
