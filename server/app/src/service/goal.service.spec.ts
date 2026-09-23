import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { goalService } from './goal.service';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Status } from 'src/enums/status.enum';

describe('goalService', () => {
  let service: goalService;
  let goalRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let skillRepo: { findOne: jest.Mock };
  let requireRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    goalRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      create: jest.fn((data) => data),
      update: jest.fn(),
    };
    skillRepo = { findOne: jest.fn() };
    requireRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Goal) return goalRepo;
        if (entity === GoalSkillRequire) return requireRepo;
        if (entity === Skill) return skillRepo;
        throw new Error(`Unexpected repository requested: ${entity}`);
      }),
    };

    dataSource = { transaction: jest.fn((cb) => cb(mockManager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalService,
        { provide: getRepositoryToken(Goal), useValue: goalRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalService>(goalService);
  });

  it('rejects an empty goal name', async () => {
    await expect(
      service.createGoalWithSkillRequire({ goal: '   ', skillRequires: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a skillId that does not exist', async () => {
    skillRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [{ skillId: 999 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a skillId that is inactive', async () => {
    skillRepo.findOne.mockResolvedValue({
      skillId: 5,
      status: Status.INACTIVE,
    });

    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [{ skillId: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets status to inactive on remove (soft delete)', async () => {
    goalRepo.findOne.mockResolvedValue({
      id: 1,
      goal: 'x',
      status: Status.ACTIVE,
    });

    await service.remove(1);

    expect(goalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: Status.INACTIVE }),
    );
  });

  it('allows an unrelated field edit to save when an existing skillRequire is now inactive', async () => {
    // Goal already has skillId 5, which has since become inactive. The admin
    // resends the full skillRequires list unchanged while fixing a typo in
    // "goal". This must NOT be blocked by the active-skill check.
    goalRepo.findOne.mockResolvedValue({
      id: 1,
      goal: 'Old name',
      status: Status.ACTIVE,
      goalSkillRequire: [{ goalId: 1, skillId: 5, levelRequire: 3 }],
    });

    await service.updateGoalWithSkillRequire(1, {
      goal: 'Fixed typo name',
      skillRequires: [{ skillId: 5, levelRequire: 3 }],
    });

    // The now-inactive existing skill must never have been sent through the
    // active-status validation query.
    expect(skillRepo.findOne).not.toHaveBeenCalled();
    expect(goalRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      { goal: 'Fixed typo name' },
    );
    expect(requireRepo.delete).toHaveBeenCalledWith({ goalId: 1 });
    expect(requireRepo.save).toHaveBeenCalledWith([
      { goalId: 1, skillId: 5, levelRequire: 3 },
    ]);
  });

  it('rejects adding a new inactive skillId on update even though existing ones are exempt', async () => {
    goalRepo.findOne.mockResolvedValue({
      id: 1,
      goal: 'Old name',
      status: Status.ACTIVE,
      goalSkillRequire: [{ goalId: 1, skillId: 5, levelRequire: 3 }],
    });
    skillRepo.findOne.mockResolvedValue({
      skillId: 7,
      status: Status.INACTIVE,
    });

    await expect(
      service.updateGoalWithSkillRequire(1, {
        skillRequires: [
          { skillId: 5, levelRequire: 3 },
          { skillId: 7, levelRequire: 2 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    // Only the new skillId (7) should have been checked against the Skill repo.
    expect(skillRepo.findOne).toHaveBeenCalledTimes(1);
    expect(skillRepo.findOne).toHaveBeenCalledWith({ where: { skillId: 7 } });
  });

  it('rejects duplicate skillId on create', async () => {
    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a frontend engineer',
        skillRequires: [
          { skillId: 5, levelRequire: 2 },
          { skillId: 5, levelRequire: 3 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate skillId on update', async () => {
    goalRepo.findOne.mockResolvedValue({
      id: 1,
      goal: 'Old name',
      status: Status.ACTIVE,
      goalSkillRequire: [{ goalId: 1, skillId: 5, levelRequire: 3 }],
    });

    await expect(
      service.updateGoalWithSkillRequire(1, {
        skillRequires: [
          { skillId: 5, levelRequire: 3 },
          { skillId: 5, levelRequire: 2 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // goal.goal_description is varchar(255): anything longer makes Postgres
  // throw, which reached the admin as an unreadable 500 instead of a 400.
  describe('goalDescription length', () => {
    const tooLong = 'ก'.repeat(256);

    it('rejects a description longer than 255 characters on create', async () => {
      await expect(
        service.createGoalWithSkillRequire({
          goal: 'Become a backend engineer',
          goalDescription: tooLong,
          skillRequires: [],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a description longer than 255 characters on update', async () => {
      goalRepo.findOne.mockResolvedValue({
        id: 1,
        goal: 'Old name',
        status: Status.ACTIVE,
        goalSkillRequire: [],
      });

      await expect(
        service.updateGoalWithSkillRequire(1, { goalDescription: tooLong }),
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a description longer than 255 characters on the generic PUT /goal/:id', async () => {
      goalRepo.findOne.mockResolvedValue({
        id: 1,
        goal: 'Old name',
        status: Status.ACTIVE,
      });

      await expect(
        service.update(1, { goalDescription: tooLong }),
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a description longer than 255 characters on the generic POST /goal', async () => {
      await expect(
        service.create({ goal: 'Become a backend engineer', goalDescription: tooLong }),
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.save).not.toHaveBeenCalled();
    });

    it('accepts a description of exactly 255 characters', async () => {
      goalRepo.findOne.mockResolvedValue({
        id: 1,
        goal: 'Become a backend engineer',
        status: Status.ACTIVE,
        goalSkillRequire: [],
      });

      await service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        goalDescription: 'ก'.repeat(255),
        skillRequires: [],
      });

      expect(goalRepo.save).toHaveBeenCalled();
    });
  });

  // levelRequire is a target skill level, the same 1-5 scale as
  // exercise.skillLevel — goalReadiness clamps anything above 5 anyway.
  describe('levelRequire range', () => {
    it.each([0, 6, 2.5])(
      'rejects levelRequire %p on create',
      async (levelRequire) => {
        skillRepo.findOne.mockResolvedValue({
          skillId: 5,
          status: Status.ACTIVE,
        });

        await expect(
          service.createGoalWithSkillRequire({
            goal: 'Become a backend engineer',
            skillRequires: [{ skillId: 5, levelRequire }],
          }),
        ).rejects.toThrow(BadRequestException);
        expect(goalRepo.save).not.toHaveBeenCalled();
      },
    );

    it('rejects an out-of-range levelRequire on update, even for a skill the goal already had', async () => {
      // Unlike the inactive-skill rule, a legacy level 6 is not grandfathered:
      // the range is a property of the value, not of when it was added.
      goalRepo.findOne.mockResolvedValue({
        id: 1,
        goal: 'Old name',
        status: Status.ACTIVE,
        goalSkillRequire: [{ goalId: 1, skillId: 5, levelRequire: 6 }],
      });

      await expect(
        service.updateGoalWithSkillRequire(1, {
          skillRequires: [{ skillId: 5, levelRequire: 6 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(requireRepo.delete).not.toHaveBeenCalled();
    });

    it('accepts levelRequire 1 and 5, and a skill with no levelRequire', async () => {
      skillRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve({ skillId: where.skillId, status: Status.ACTIVE }),
      );
      goalRepo.findOne.mockResolvedValue({
        id: 1,
        goal: 'Become a backend engineer',
        status: Status.ACTIVE,
        goalSkillRequire: [],
      });

      await service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [
          { skillId: 1, levelRequire: 1 },
          { skillId: 5, levelRequire: 5 },
          { skillId: 7 },
        ],
      });

      expect(requireRepo.save).toHaveBeenCalledWith([
        { goalId: 1, skillId: 1, levelRequire: 1 },
        { goalId: 1, skillId: 5, levelRequire: 5 },
        { goalId: 1, skillId: 7, levelRequire: undefined },
      ]);
    });
  });
});
