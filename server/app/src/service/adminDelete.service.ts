import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Branch } from 'src/entity/branch.entity';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { SkillPrerequisite } from 'src/entity/skillPrerequisite.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { ExerciseChoice } from 'src/entity/exerciseAndSession/exerciseChoice.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { SessionAndExercise } from 'src/entity/exerciseAndSession/sessionAndExercise.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { LoginLog } from 'src/entity/loginLog.entity';

/** Why a delete was refused — the frontend turns `code` into a localized message. */
export class DeleteBlockedError extends Error {
  constructor(
    readonly code:
      | 'EXERCISE_ANSWERED'
      | 'SKILL_HAS_LEARNERS'
      | 'SKILL_IN_USE'
      | 'GOAL_HAS_LEARNERS'
      | 'USER_HAS_BRANCHES'
      | 'CANNOT_DELETE_SELF',
    readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/**
 * Admin hard delete — only for things no learner has used yet (e.g. created by mistake).
 * Anything with learning data (sessions, answers, branches) is refused with DeleteBlockedError;
 * the admin deactivates it instead (status switch), so progress and stats are never lost.
 * Structure-only rows (choices, goal↔skill links, login log) are removed together, in one
 * transaction — all or nothing.
 */
@Injectable()
export class adminDeleteService {
  constructor(private readonly dataSource: DataSource) {}

  async deleteExercise(id: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const exercise = await m.findOne(Exercise, { where: { id } });
      if (!exercise) throw new NotFoundException(`Exercise ${id} not found`);
      const used = await m.count(SessionAndExercise, { where: { exerciseId: id } });
      if (used > 0) throw new DeleteBlockedError('EXERCISE_ANSWERED', { count: used });
      await m.delete(ExerciseChoice, { exerciseId: id });
      await m.delete(Exercise, { id });
    });
  }

  async deleteSkill(skillId: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const skill = await m.findOne(Skill, { where: { skillId } });
      if (!skill) throw new NotFoundException(`Skill ${skillId} not found`);

      // learners: a practice/pretest session on it, or progress on it in any branch
      const sessions = await m.count(Session, { where: { skillId } });
      const branchesWithProgress = await m
        .createQueryBuilder(Branch, 'b')
        .where(`(b."conceptMapState" -> :key ->> 'attemptCount')::int > 0`, {
          key: String(skillId),
        })
        .getCount();
      if (sessions > 0 || branchesWithProgress > 0) {
        throw new DeleteBlockedError('SKILL_HAS_LEARNERS', {
          count: Math.max(sessions, branchesWithProgress),
        });
      }

      // structure: removing it silently would change those goals / skill trees
      const goalLinks = await m.find(GoalSkillRequire, {
        where: { skillId },
        relations: { goal: true },
      });
      const dependents = await m.find(SkillPrerequisite, {
        where: { prerequisiteSkillId: skillId },
        relations: { skill: true },
      });
      if (goalLinks.length > 0 || dependents.length > 0) {
        throw new DeleteBlockedError('SKILL_IN_USE', {
          goals: goalLinks.map((g) => g.goal?.goal).filter(Boolean),
          skills: dependents.map((d) => d.skill?.skillsName).filter(Boolean),
        });
      }

      const exerciseIds = (
        await m.find(Exercise, { where: { skillId }, select: { id: true } })
      ).map((e) => e.id);
      if (exerciseIds.length > 0) {
        await m.delete(ExerciseChoice, { exerciseId: In(exerciseIds) });
        await m.delete(Exercise, { id: In(exerciseIds) });
      }
      await m.delete(SkillPrerequisite, { skillId });
      await m.delete(Skill, { skillId });
    });
  }

  async deleteGoal(id: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const goal = await m.findOne(Goal, { where: { id } });
      if (!goal) throw new NotFoundException(`Goal ${id} not found`);
      const learners = await m.count(Branch, { where: { goalId: id } });
      if (learners > 0) throw new DeleteBlockedError('GOAL_HAS_LEARNERS', { count: learners });
      await m.delete(GoalSkillRequire, { goalId: id });
      await m.delete(Goal, { id });
    });
  }

  async deleteUser(id: number, requesterId: number): Promise<void> {
    if (id === requesterId) throw new DeleteBlockedError('CANNOT_DELETE_SELF');
    await this.dataSource.transaction(async (m: EntityManager) => {
      const user = await m.findOne(Userprofile, { where: { id } });
      if (!user) throw new NotFoundException(`User ${id} not found`);
      const branches = await m.count(Branch, { where: { userId: id } });
      if (branches > 0) throw new DeleteBlockedError('USER_HAS_BRANCHES', { count: branches });
      await m.delete(LoginLog, { userId: id });
      await m.delete(Userprofile, { id });
    });
  }
}
