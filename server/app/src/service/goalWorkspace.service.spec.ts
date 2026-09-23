import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { goalWorkspaceService } from './goalWorkspace.service';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { Branch } from 'src/entity/branch.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { Status } from 'src/enums/status.enum';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { MIN_EXERCISES_PER_SKILL } from 'src/libs/goal/goalReadiness';

describe('goalWorkspaceService.getWorkspace', () => {
  let service: goalWorkspaceService;
  let goalRepo: { findOne: jest.Mock; find: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let exerciseRepo: { find: jest.Mock };
  let branchRepo: { count: jest.Mock };
  let aiDraftRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  // goal 1 requires skill 2; skill 2 requires skill 1 (a pulled-in prerequisite)
  const theGoal = {
    id: 1,
    goal: 'Become a backend engineer',
    goalDescription: 'desc',
    status: Status.INACTIVE,
    goalSkillRequire: [{ goalId: 1, skillId: 2, levelRequire: 3 }],
  };
  const allSkills = [
    {
      skillId: 1,
      skillCode: 'S1',
      skillsName: 'Variables',
      tier: 'T1',
      status: Status.INACTIVE,
      skillPrequisite: [],
    },
    {
      skillId: 2,
      skillCode: 'S2',
      skillsName: 'Loops',
      tier: 'T2',
      status: Status.ACTIVE,
      skillPrequisite: [{ prerequisiteSkillId: 1 }],
    },
    {
      skillId: 3,
      skillCode: 'S3',
      skillsName: 'Unrelated',
      tier: 'T1',
      status: Status.ACTIVE,
      skillPrequisite: [],
    },
  ];

  beforeEach(async () => {
    goalRepo = {
      findOne: jest.fn().mockResolvedValue(theGoal),
      find: jest.fn().mockResolvedValue([theGoal]),
    };
    skillRepo = { find: jest.fn().mockResolvedValue(allSkills) };
    exerciseRepo = { find: jest.fn().mockResolvedValue([]) };
    branchRepo = { count: jest.fn().mockResolvedValue(4) };
    aiDraftRepo = { find: jest.fn().mockResolvedValue([]) };
    dataSource = { transaction: jest.fn((cb) => cb({ update: jest.fn() })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalWorkspaceService,
        { provide: getRepositoryToken(Goal), useValue: goalRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(AiDraft), useValue: aiDraftRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalWorkspaceService>(goalWorkspaceService);
  });

  it('throws NotFoundException for a goal that does not exist', async () => {
    goalRepo.findOne.mockResolvedValue(null);
    await expect(service.getWorkspace(99)).rejects.toThrow(NotFoundException);
  });

  it('returns the closure — required skills plus their prerequisites, nothing else', async () => {
    const result = await service.getWorkspace(1);

    expect(result.skills.map((s) => s.skillId).sort()).toEqual([1, 2]);
    expect(result.skills.find((s) => s.skillId === 2)!.required).toBe(true);
    expect(result.skills.find((s) => s.skillId === 2)!.levelRequire).toBe(3);
    // pulled in only because skill 2 depends on it
    expect(result.skills.find((s) => s.skillId === 1)!.required).toBe(false);
    expect(result.skills.find((s) => s.skillId === 1)!.levelRequire).toBeNull();
    expect(result.skills.find((s) => s.skillId === 2)!.prerequisiteSkillIds).toEqual([1]);
  });

  it('reports the branch count and the shared exercise minimum', async () => {
    const result = await service.getWorkspace(1);
    expect(result.branchCount).toBe(4);
    expect(result.minExercisesPerSkill).toBe(MIN_EXERCISES_PER_SKILL);
    expect(branchRepo.count).toHaveBeenCalledWith({ where: { goalId: 1 } });
  });

  it('counts active exercises per skill and collects their distinct levels', async () => {
    // skill 2 gets exactly the minimum (one at level 5, the rest at level 3)
    exerciseRepo.find.mockResolvedValue([
      ...Array.from({ length: MIN_EXERCISES_PER_SKILL }, (_, i) => ({
        skillId: 2,
        skillLevel: i === 0 ? 5 : 3,
      })),
      { skillId: 1, skillLevel: 1 },
    ]);

    const result = await service.getWorkspace(1);
    const loops = result.skills.find((s) => s.skillId === 2)!;
    const variables = result.skills.find((s) => s.skillId === 1)!;

    expect(loops.activeExerciseCount).toBe(MIN_EXERCISES_PER_SKILL);
    expect(loops.activeExerciseLevels.sort()).toEqual([3, 5]);
    expect(loops.readiness).toBe('ready');
    expect(variables.activeExerciseCount).toBe(1);
    expect(variables.readiness).toBe('partial');
    // only active exercises are ever loaded
    expect(exerciseRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: Status.ACTIVE }) }),
    );
  });

  it('counts pending exercise drafts for skills in the closure only', async () => {
    aiDraftRepo.find.mockResolvedValue([
      { id: 10, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: { skillId: 2 } },
      { id: 11, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: { skillId: 3 } },
      { id: 12, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: {} },
    ]);

    const result = await service.getWorkspace(1);
    expect(result.skills.find((s) => s.skillId === 2)!.pendingDraftCount).toBe(1);
    expect(result.skills.find((s) => s.skillId === 1)!.pendingDraftCount).toBe(0);
  });

  it('counts how many goals pull each skill into their closure', async () => {
    goalRepo.find.mockResolvedValue([
      theGoal,
      { id: 2, goal: 'Another', status: Status.ACTIVE, goalSkillRequire: [{ skillId: 1 }] },
    ]);

    const result = await service.getWorkspace(1);
    // skill 1 is in goal 1's closure (as a prerequisite) and is goal 2's required skill
    expect(result.skills.find((s) => s.skillId === 1)!.goalCount).toBe(2);
    expect(result.skills.find((s) => s.skillId === 2)!.goalCount).toBe(1);
  });

  it('reports readiness for the whole closure', async () => {
    const result = await service.getWorkspace(1);
    // no exercises anywhere, so MIN_EXERCISES must fail and name both skills
    const minExercises = result.readiness.checks.find((c) => c.rule === 'MIN_EXERCISES')!;
    expect(result.readiness.ready).toBe(false);
    expect(minExercises.passed).toBe(false);
    expect(minExercises.skillIds.sort()).toEqual([1, 2]);
  });
});

describe('goalWorkspaceService.publish', () => {
  // Drives getWorkspace through a spy, so these tests state publish's behaviour
  // without re-mocking every repository query.
  let service: goalWorkspaceService;
  let managerUpdate: jest.Mock;
  let dataSource: { transaction: jest.Mock };

  const readyWorkspace = {
    goal: { id: 1, goal: 'G', goalDescription: null, status: Status.INACTIVE },
    branchCount: 0,
    minExercisesPerSkill: MIN_EXERCISES_PER_SKILL,
    skills: [
      { skillId: 1, status: Status.INACTIVE },
      { skillId: 2, status: Status.ACTIVE },
    ],
    readiness: { ready: true, checks: [] },
  };

  beforeEach(async () => {
    managerUpdate = jest.fn();
    dataSource = {
      transaction: jest.fn((cb) => cb({ update: managerUpdate })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalWorkspaceService,
        { provide: getRepositoryToken(Goal), useValue: { findOne: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Skill), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Exercise), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Branch), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(AiDraft), useValue: { find: jest.fn() } },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalWorkspaceService>(goalWorkspaceService);
  });

  it('activates the goal and every inactive skill in the closure', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue(readyWorkspace as any);

    const result = await service.publish(1);

    expect(result).toEqual({ activatedGoal: true, activatedSkillIds: [1] });
    expect(managerUpdate).toHaveBeenCalledWith(Goal, { id: 1 }, { status: Status.ACTIVE });
    expect(managerUpdate).toHaveBeenCalledWith(
      Skill,
      { skillId: In([1]) },
      { status: Status.ACTIVE },
    );
  });

  it('never writes to exercise', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue(readyWorkspace as any);

    await service.publish(1);

    const touchedEntities = managerUpdate.mock.calls.map((call) => call[0]);
    expect(touchedEntities).not.toContain(Exercise);
  });

  it('is idempotent — a second publish activates nothing', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue({
      ...readyWorkspace,
      goal: { ...readyWorkspace.goal, status: Status.ACTIVE },
      skills: [
        { skillId: 1, status: Status.ACTIVE },
        { skillId: 2, status: Status.ACTIVE },
      ],
    } as any);

    const result = await service.publish(1);

    expect(result).toEqual({ activatedGoal: false, activatedSkillIds: [] });
    expect(managerUpdate).not.toHaveBeenCalled();
  });

  it('throws BadRequestException with the failing checks and writes nothing', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue({
      ...readyWorkspace,
      readiness: {
        ready: false,
        checks: [
          { rule: 'MIN_EXERCISES', passed: false, skillIds: [1] },
          { rule: 'NO_PREREQ_CYCLE', passed: true, skillIds: [] },
        ],
      },
    } as any);

    await expect(service.publish(1)).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();

    // only the failing rules travel back to the admin
    await service.publish(1).catch((err: BadRequestException) => {
      expect((err.getResponse() as { checks: unknown[] }).checks).toEqual([
        { rule: 'MIN_EXERCISES', passed: false, skillIds: [1] },
      ]);
    });
  });
});
