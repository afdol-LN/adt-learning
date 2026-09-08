import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sessionService } from './session.service';
import { ktService } from './kt.service';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { SessionAndExercise } from 'src/entity/exerciseAndSession/sessionAndExercise.entity';
import { History } from 'src/entity/history.entity';

describe('sessionService.recommendNextSkill reads per-branch mastery', () => {
  let service: sessionService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { find: jest.Mock };

  const goal = { goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }] };

  // Same user, same goal skills, two branches at different points.
  const practisedBranch = {
    id: 1,
    userId: 42,
    goal,
    conceptMapState: {
      '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 5 },
    },
  };
  const freshBranch = { id: 2, userId: 42, goal, conceptMapState: null };

  const skills = [
    {
      skillId: 1,
      skillCode: 'SK1',
      skillsName: 'Skill 1',
      tier: 'T1',
      pL0: 0.25,
      pT: 0.1,
      skillPrequisite: [],
    },
    {
      skillId: 2,
      skillCode: 'SK2',
      skillsName: 'Skill 2',
      tier: 'T2',
      pL0: 0.25,
      pT: 0.1,
      skillPrequisite: [
        { skillId: 2, prerequisiteSkillId: 1, prerequisiteLevel: 1 },
      ],
    },
  ];

  beforeEach(async () => {
    branchRepo = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(where.id === 1 ? practisedBranch : freshBranch),
      ),
    };
    skillRepo = { find: jest.fn().mockResolvedValue(skills) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        sessionService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Exercise), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: getRepositoryToken(SessionAndExercise), useValue: {} },
        { provide: getRepositoryToken(History), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ktService, useValue: {} },
      ],
    }).compile();

    service = module.get<sessionService>(sessionService);
  });

  it('recommends the follow-on skill for a branch that mastered the prerequisite', async () => {
    const result = await service.recommendNextSkill(1, 42);
    expect(result?.skillId).toBe(2);
  });

  it('recommends the prerequisite skill for a branch with no progress yet', async () => {
    // Proves branch 1's mastery of skill 1 does not unlock skill 2 here.
    const result = await service.recommendNextSkill(2, 42);
    expect(result?.skillId).toBe(1);
  });
});
