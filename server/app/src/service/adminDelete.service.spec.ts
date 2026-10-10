import { NotFoundException } from '@nestjs/common';
import { adminDeleteService, DeleteBlockedError } from './adminDelete.service';
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

/** In-memory EntityManager: counts/finds per entity are set per test; deletes are recorded. */
function makeManager(opts: {
  exists?: boolean;
  counts?: Map<unknown, number>;
  finds?: Map<unknown, unknown[]>;
  progressBranches?: number;
}) {
  const deleted: [unknown, unknown][] = [];
  const m = {
    findOne: jest.fn(async () => (opts.exists === false ? null : { id: 1 })),
    count: jest.fn(async (entity: unknown) => opts.counts?.get(entity) ?? 0),
    find: jest.fn(async (entity: unknown) => opts.finds?.get(entity) ?? []),
    delete: jest.fn(async (entity: unknown, where: unknown) => {
      deleted.push([entity, where]);
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = { where: jest.fn(() => qb), getCount: jest.fn(async () => opts.progressBranches ?? 0) };
      return qb;
    }),
  };
  const dataSource = { transaction: jest.fn(async (cb: (mm: unknown) => unknown) => cb(m)) };
  return { service: new adminDeleteService(dataSource as any), deleted };
}

const blockedCode = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof DeleteBlockedError ? e.code : (e as Error).constructor.name;
  }
  return 'NOT_THROWN';
};

describe('adminDeleteService', () => {
  describe('deleteExercise', () => {
    it('refuses an exercise any learner has been given', async () => {
      const { service, deleted } = makeManager({ counts: new Map([[SessionAndExercise, 3]]) });
      expect(await blockedCode(service.deleteExercise(1))).toBe('EXERCISE_ANSWERED');
      expect(deleted).toHaveLength(0);
    });
    it('deletes an unused exercise with its choices', async () => {
      const { service, deleted } = makeManager({});
      await service.deleteExercise(5);
      expect(deleted.map(([e]) => e)).toEqual([ExerciseChoice, Exercise]);
    });
    it('404s an unknown exercise', async () => {
      const { service } = makeManager({ exists: false });
      await expect(service.deleteExercise(9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteSkill', () => {
    it('refuses a skill that has a session', async () => {
      const { service, deleted } = makeManager({ counts: new Map([[Session, 1]]) });
      expect(await blockedCode(service.deleteSkill(1))).toBe('SKILL_HAS_LEARNERS');
      expect(deleted).toHaveLength(0);
    });
    it('refuses a skill with progress in a branch', async () => {
      const { service } = makeManager({ progressBranches: 2 });
      expect(await blockedCode(service.deleteSkill(1))).toBe('SKILL_HAS_LEARNERS');
    });
    it('refuses a skill a goal still requires (would silently change the goal)', async () => {
      const { service, deleted } = makeManager({
        finds: new Map([[GoalSkillRequire, [{ goal: { goal: 'Web Dev' } }]]]),
      });
      expect(await blockedCode(service.deleteSkill(1))).toBe('SKILL_IN_USE');
      expect(deleted).toHaveLength(0);
    });
    it('refuses a skill another skill depends on', async () => {
      const { service } = makeManager({
        finds: new Map([[SkillPrerequisite, [{ skill: { skillsName: 'Trees' } }]]]),
      });
      expect(await blockedCode(service.deleteSkill(1))).toBe('SKILL_IN_USE');
    });
    it('deletes an unused skill with its unused exercises and own prerequisite links', async () => {
      const { service, deleted } = makeManager({
        finds: new Map([[Exercise, [{ id: 7 }, { id: 8 }]]]),
      });
      await service.deleteSkill(4);
      expect(deleted.map(([e]) => e)).toEqual([ExerciseChoice, Exercise, SkillPrerequisite, Skill]);
    });
  });

  describe('deleteGoal', () => {
    it('refuses a goal any learner picked', async () => {
      const { service, deleted } = makeManager({ counts: new Map([[Branch, 4]]) });
      expect(await blockedCode(service.deleteGoal(1))).toBe('GOAL_HAS_LEARNERS');
      expect(deleted).toHaveLength(0);
    });
    it('deletes an unused goal with its skill links', async () => {
      const { service, deleted } = makeManager({});
      await service.deleteGoal(2);
      expect(deleted.map(([e]) => e)).toEqual([GoalSkillRequire, Goal]);
    });
  });

  describe('deleteUser', () => {
    it('refuses deleting yourself', async () => {
      const { service, deleted } = makeManager({});
      expect(await blockedCode(service.deleteUser(5, 5))).toBe('CANNOT_DELETE_SELF');
      expect(deleted).toHaveLength(0);
    });
    it('refuses a user with a learning branch', async () => {
      const { service } = makeManager({ counts: new Map([[Branch, 1]]) });
      expect(await blockedCode(service.deleteUser(5, 1))).toBe('USER_HAS_BRANCHES');
    });
    it('deletes a user with no branch, with their login log', async () => {
      const { service, deleted } = makeManager({});
      await service.deleteUser(5, 1);
      expect(deleted.map(([e]) => e)).toEqual([LoginLog, Userprofile]);
    });
  });
});
