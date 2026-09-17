import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { skillService } from './skill.service';
import { Skill } from 'src/entity/skill.entity';
import { SkillPrerequisite } from 'src/entity/skillPrerequisite.entity';

describe('skillService prerequisite cycles', () => {
  let service: skillService;
  let skillRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let prereqRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    skillRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((e) => Promise.resolve({ skillId: 1, ...e })),
      create: jest.fn((d) => d),
      update: jest.fn(),
    };
    prereqRepo = { create: jest.fn((d) => d), save: jest.fn(), delete: jest.fn() };

    const mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Skill) return skillRepo;
        if (entity === SkillPrerequisite) return prereqRepo;
        throw new Error(`Unexpected repository requested: ${String(entity)}`);
      }),
    };
    dataSource = { transaction: jest.fn((cb) => cb(mockManager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        skillService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<skillService>(skillService);
  });

  it('rejects a prerequisite chain that loops back to the skill', async () => {
    // skill 2 already requires skill 1. Making 2 a prerequisite of 1 closes a cycle.
    skillRepo.findOne.mockResolvedValue({ skillId: 1, skillPrequisite: [] });
    skillRepo.find.mockResolvedValue([
      { skillId: 1, skillPrequisite: [] },
      { skillId: 2, skillPrequisite: [{ prerequisiteSkillId: 1 }] },
    ]);

    await expect(
      service.updateSkillWithPrerequisite(1, {
        prerequisites: [{ prerequisiteSkillId: 2 }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prereqRepo.save).not.toHaveBeenCalled();
  });

  it('accepts a prerequisite that keeps the graph acyclic', async () => {
    skillRepo.findOne.mockResolvedValue({ skillId: 3, skillPrequisite: [] });
    skillRepo.find.mockResolvedValue([
      { skillId: 1, skillPrequisite: [] },
      { skillId: 2, skillPrequisite: [{ prerequisiteSkillId: 1 }] },
      { skillId: 3, skillPrequisite: [] },
    ]);

    await service.updateSkillWithPrerequisite(3, {
      prerequisites: [{ prerequisiteSkillId: 2 }],
    });

    expect(prereqRepo.save).toHaveBeenCalledWith([
      { skillId: 3, prerequisiteSkillId: 2, prerequisiteLevel: undefined },
    ]);
  });
});
