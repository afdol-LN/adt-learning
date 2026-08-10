import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { historyService } from './history.service';
import { History } from 'src/entity/history.entity';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import { Userprofile } from 'src/entity/userprofile.entity';

describe('historyService conceptMapState-driven read side', () => {
  let service: historyService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let userprofileRepo: { findOne: jest.Mock };
  let historyRepo: { find: jest.Mock };

  const branch = {
    id: 1,
    userId: 42,
    goal: { goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }] },
  };
  const skills = [
    { skillId: 1, skillCode: 'SK1', skillsName: 'Skill 1', tier: 'T1', status: 'active', pL0: 0.25, skillPrequisite: [] },
    {
      skillId: 2,
      skillCode: 'SK2',
      skillsName: 'Skill 2',
      tier: 'T2',
      status: 'active',
      pL0: 0.25,
      skillPrequisite: [{ skillId: 2, prerequisiteSkillId: 1, prerequisiteLevel: 1 }],
    },
  ];

  beforeEach(async () => {
    branchRepo = { findOne: jest.fn().mockResolvedValue(branch) };
    skillRepo = { find: jest.fn().mockResolvedValue(skills) };
    historyRepo = { find: jest.fn().mockResolvedValue([]) };
    userprofileRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 42,
        conceptMapState: {
          '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 5 },
          '2': { pL: 0.1, progress: 11, status: 'unlocked', attemptCount: 0 },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        historyService,
        { provide: getRepositoryToken(History), useValue: historyRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Userprofile), useValue: userprofileRepo },
      ],
    }).compile();

    service = module.get<historyService>(historyService);
  });

  it('getBranchSkills reports progress and attemptCount from conceptMapState', async () => {
    const result = await service.getBranchSkills(1, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    const skill2 = result.find((s) => s.skillId === 2);
    expect(skill1.progressPercent).toBe(100);
    expect(skill1.attemptCount).toBe(5);
    expect(skill2.progressPercent).toBe(11);
    expect(skill2.attemptCount).toBe(0); // not-started, even though pL > 0
  });

  it('falls back to skill.pL0 when a goal skill has no conceptMapState entry', async () => {
    userprofileRepo.findOne.mockResolvedValue({ id: 42, conceptMapState: {} });
    const result = await service.getBranchSkills(1, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    expect(skill1.attemptCount).toBe(0);
    expect(skill1.progressPercent).toBe(Math.min(100, Math.round((0.25 / 0.95) * 100)));
  });

  it('getBranchStats counts a skill as unlocked only when every prerequisite has pL >= 0.95', async () => {
    const stats = await service.getBranchStats(1, 42);
    // skill 1 has no prereqs -> unlocked; skill 2's prereq (1) is at pL 0.96 -> unlocked too
    expect(stats.skillsUnlockedCount).toBe(2);
  });

  it('getBranchStats does not count a skill as unlocked when its prerequisite is below threshold', async () => {
    userprofileRepo.findOne.mockResolvedValue({
      id: 42,
      conceptMapState: {
        '1': { pL: 0.5, progress: 53, status: 'unlocked', attemptCount: 3 },
        '2': { pL: 0.1, progress: 11, status: 'unlocked', attemptCount: 0 },
      },
    });
    const stats = await service.getBranchStats(1, 42);
    expect(stats.skillsUnlockedCount).toBe(1); // only skill 1 (no prereqs)
  });
});
