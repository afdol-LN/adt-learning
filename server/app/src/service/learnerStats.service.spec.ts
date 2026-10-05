import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { learnerStatsService } from './learnerStats.service';
import { Branch } from 'src/entity/branch.entity';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { History } from 'src/entity/history.entity';

describe('learnerStatsService', () => {
  let service: learnerStatsService;
  let activityRows: any[];

  const goal = { id: 9, goal: 'Web Developer', goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }] };
  const skills = [
    { skillId: 1, skillsName: 'Skill 1', pL0: 0.25 },
    { skillId: 2, skillsName: 'Skill 2', pL0: 0.25 },
  ];
  const user = (id: number, fullName: string) => ({ id, fullName, username: `u${id}` });

  // mastered skill 1, half-way on skill 2 (pL 0.475 → progress 50)
  const halfway = {
    id: 1,
    userId: 10,
    goalId: 9,
    user: user(10, 'Ann'),
    goal,
    isAlreadyPretest: true,
    goalCompletedAt: null,
    createdAt: new Date('2026-09-01'),
    conceptMapState: {
      '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 4 },
      '2': { pL: 0.475, progress: 50, status: 'unlocked', attemptCount: 2 },
    },
  };
  // completed earlier, skill 2 dropped since — completion sticks at 100 (buildGoalNode rule)
  const completed = {
    id: 2,
    userId: 11,
    goalId: 9,
    user: user(11, 'Ben'),
    goal,
    isAlreadyPretest: true,
    goalCompletedAt: new Date('2026-09-20'),
    createdAt: new Date('2026-08-01'),
    conceptMapState: {
      '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 5 },
      '2': { pL: 0.9, progress: 94.73, status: 'unlocked', attemptCount: 6 },
    },
  };
  // picked the goal, never practised — not started skills count 0
  const fresh = {
    id: 3,
    userId: 12,
    goalId: 9,
    user: user(12, 'Cat'),
    goal,
    isAlreadyPretest: false,
    goalCompletedAt: null,
    createdAt: new Date('2026-09-25'),
    conceptMapState: {},
  };

  beforeEach(async () => {
    activityRows = [];
    const qb: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'innerJoin']) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getRawMany = jest.fn(async () => activityRows);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        learnerStatsService,
        {
          provide: getRepositoryToken(Branch),
          useValue: {
            find: jest.fn(async ({ where }: any = {}) =>
              [halfway, completed, fresh].filter((b) => !where || b.goalId === where.goalId),
            ),
          },
        },
        {
          provide: getRepositoryToken(Goal),
          useValue: { findOne: jest.fn(async ({ where }: any) => (where.id === 9 ? goal : null)) },
        },
        {
          provide: getRepositoryToken(Skill),
          useValue: {
            find: jest.fn(async () => skills),
            findOne: jest.fn(async ({ where }: any) => skills.find((s) => s.skillId === where.skillId) ?? null),
          },
        },
        { provide: getRepositoryToken(History), useValue: { createQueryBuilder: jest.fn(() => qb) } },
      ],
    }).compile();
    service = module.get(learnerStatsService);
  });

  describe('getGoalLearners', () => {
    it('lists every branch on the goal with the same progress the goal node shows', async () => {
      activityRows = [{ branchId: 1, lastAt: new Date('2026-09-30'), answered: '6', correct: '4' }];
      const res = await service.getGoalLearners(9);

      expect(res.totalLearners).toBe(3);
      expect(res.requiredCount).toBe(2);
      // sorted by progress, highest first
      expect(res.learners.map((l) => l.name)).toEqual(['Ben', 'Ann', 'Cat']);

      const [ben, ann, cat] = res.learners;
      expect(ben.progressPercent).toBe(100); // sticky completion
      expect(ann.progressPercent).toBe(75); // (100 + 50) / 2
      expect(ann.masteredCount).toBe(1);
      expect(ann.lastActiveAt).toEqual(new Date('2026-09-30'));
      expect(cat.progressPercent).toBe(0); // not started counts 0, never pL0
      expect(cat.lastActiveAt).toBeNull();

      expect(res.completedCount).toBe(1);
      expect(res.pretestDoneCount).toBe(2);
      expect(res.avgProgress).toBe(58.33); // (100 + 75 + 0) / 3, truncated
    });

    it('throws NotFound for an unknown goal', async () => {
      await expect(service.getGoalLearners(404)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getSkillLearners', () => {
    it('lists only learners who practised the skill, with Progress (not raw pL)', async () => {
      activityRows = [
        { branchId: 1, lastAt: new Date('2026-09-30'), answered: '2', correct: '1' },
        { branchId: 2, lastAt: new Date('2026-09-10'), answered: '6', correct: '5' },
      ];
      const res = await service.getSkillLearners(2);

      expect(res.skillName).toBe('Skill 2');
      expect(res.totalLearners).toBe(2); // fresh branch never practised → excluded
      const [ben, ann] = res.learners;
      expect(ben.name).toBe('Ben');
      expect(ben.progressPercent).toBe(94.73); // pL 0.9 / 0.95, truncated
      expect(ben.mastered).toBe(false);
      expect(ann.progressPercent).toBe(50);
      expect(ann.goalName).toBe('Web Developer');

      expect(res.masteredCount).toBe(0);
      expect(res.totalAnswered).toBe(8);
      expect(res.correctRate).toBe(75); // 6 / 8
    });

    it('throws NotFound for an unknown skill', async () => {
      await expect(service.getSkillLearners(404)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
