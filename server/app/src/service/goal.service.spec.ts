import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { goalService } from './goal.service';
import { Goal } from '../entity/goal.entity';
import { GoalSkillRequire } from '../entity/goalSkillRequire.entity';
import { Skill } from '../entity/skill.entity';
import { Status } from '../enums/status.enum';

describe('goalService', () => {
  let service: goalService;
  let goalRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
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
    requireRepo = { create: jest.fn((data) => data), save: jest.fn(), delete: jest.fn() };

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
    skillRepo.findOne.mockResolvedValue({ skillId: 5, status: Status.INACTIVE });

    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [{ skillId: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets status to inactive on remove (soft delete)', async () => {
    goalRepo.findOne.mockResolvedValue({ id: 1, goal: 'x', status: Status.ACTIVE });

    await service.remove(1);

    expect(goalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: Status.INACTIVE }),
    );
  });
});
