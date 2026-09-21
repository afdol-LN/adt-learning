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
import { ExerciseType } from 'src/enums/exercise-type.enum';
import { MasteryState } from 'src/libs/bkt/masteryState';

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

// docs/adr/0001: the Exercise screen must show the same Progress as the skill-tree node,
// i.e. exactly the conceptMapState entry that getBranchSkills reads.
describe('sessionService returns the skill-tree Progress with each question', () => {
  let service: sessionService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { findOne: jest.Mock; find: jest.Mock };
  let exerciseRepo: { find: jest.Mock; findOne: jest.Mock };
  let sessionRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let sessionAndExerciseRepo: { find: jest.Mock };
  let kt: { submitAttempt: jest.Mock };

  const skill = { skillId: 1, pL0: 0.25, pT: 0.1, skillPrequisite: [] };
  const exercise = (id: number) => ({
    id,
    skillId: 1,
    type: ExerciseType.CHOICE,
    description: `q${id}`,
    skillLevel: 3,
    pG: 0.2,
    pS: 0.1,
    expectTime: 30,
    exerciseChoices: [{ id: id * 10, script: 'right', isAnswer: true }],
  });
  const practised = () => ({
    '1': { pL: 0.5, progress: 53, status: 'unlocked', attemptCount: 3 },
  });

  beforeEach(async () => {
    branchRepo = { findOne: jest.fn() };
    skillRepo = {
      findOne: jest.fn().mockResolvedValue(skill),
      find: jest.fn().mockResolvedValue([skill]),
    };
    exerciseRepo = {
      find: jest.fn().mockResolvedValue([exercise(10), exercise(11)]),
      findOne: jest.fn().mockResolvedValue(exercise(10)),
    };
    sessionRepo = {
      create: jest.fn((x) => x),
      // a new session gets id 99; closing drafts saves an array of existing ones
      save: jest.fn((x) =>
        Promise.resolve(Array.isArray(x) ? x : { ...x, id: x.id ?? 99 }),
      ),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]), // no open sessions = no draft
    };
    sessionAndExerciseRepo = { find: jest.fn().mockResolvedValue([]) };
    kt = {
      submitAttempt: jest
        .fn()
        .mockResolvedValue({ isError: false, data: { pLNext: 0.6 } }),
    };
    const manager = {
      getRepository: () => ({ save: (x: any) => Promise.resolve({ ...x, id: 1 }) }),
      create: (_entity: unknown, x: any) => x,
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        sessionService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        {
          provide: getRepositoryToken(SessionAndExercise),
          useValue: sessionAndExerciseRepo,
        },
        { provide: getRepositoryToken(History), useValue: {} },
        {
          provide: DataSource,
          useValue: { transaction: (cb: any) => cb(manager) },
        },
        { provide: ktService, useValue: kt },
      ],
    }).compile();

    service = module.get<sessionService>(sessionService);
  });

  it('startSession returns the progress of a practised skill, re-derived from pL', async () => {
    branchRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 42,
      conceptMapState: practised(),
    });

    const res = await service.startSession(42, { branchId: 1, skillId: 1 });

    // stored 53 came from the old rounded formula; pL 0.5 → 52.631… → 52.63 (docs/adr/0004)
    expect(res.progress).toEqual({ progressPercent: 52.63, attemptCount: 3 });
    // the rules card states this number, so it must come from the service
    expect(res.questionLimit).toBe(8);
  });

  it('startSession reports a never-attempted skill as not started (attemptCount 0)', async () => {
    branchRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 42,
      conceptMapState: null,
    });

    const res = await service.startSession(42, { branchId: 1, skillId: 1 });

    expect(res.progress.attemptCount).toBe(0);
    expect(res.progress.progressPercent).toBe(
      MasteryState.buildEntry(0.25, 0).progress,
    );
  });

  it('startSession sends the question level so the card can show it', async () => {
    branchRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 42,
      conceptMapState: null,
    });

    const res = await service.startSession(42, { branchId: 1, skillId: 1 });

    expect(res.question.skillLevel).toBe(3);
  });

  it('submitAnswer returns exactly the entry it writes for the skill tree', async () => {
    const branch = { id: 1, userId: 42, conceptMapState: practised() };
    sessionRepo.findOne.mockResolvedValue({
      id: 99,
      branchId: 1,
      skillId: 1,
      endedAt: null,
      branch,
    });

    const res = await service.submitAnswer(42, 99, {
      exerciseId: 10,
      chosenAnswer: 'right',
      startTime: '2026-09-13T10:00:00Z',
      endTime: '2026-09-13T10:00:20Z',
    });

    // pL 0.6 → 0.6 / 0.95 × 100 = 63.157… → 63.15 (never rounded up), one more attempt than before
    expect(res.progress).toEqual({ progressPercent: 63.15, attemptCount: 4 });
    expect(res.progress).toEqual(
      MasteryState.toProgress(branch.conceptMapState['1']),
    );
  });

  // docs/adr/0005: goal completion is recorded once and celebrated on the answer that caused it
  const goalBranch = (goalCompletedAt: Date | null) => ({
    id: 1,
    userId: 42,
    goalId: 7,
    conceptMapState: practised(),
    goalCompletedAt,
    goal: {
      id: 7,
      goal: 'Web Developer',
      goalSkillRequire: [{ goalId: 7, skillId: 1 }],
    },
  });
  const masteringAnswer = async (branch: ReturnType<typeof goalBranch>) => {
    sessionRepo.findOne.mockResolvedValue({
      id: 99,
      branchId: 1,
      skillId: 1,
      endedAt: null,
      branch,
    });
    branchRepo.findOne.mockResolvedValue(branch); // recommendNextSkill once the session ends
    kt.submitAttempt.mockResolvedValue({
      isError: false,
      data: { pLNext: 0.96 },
    });
    return service.submitAnswer(42, 99, {
      exerciseId: 10,
      chosenAnswer: 'right',
      startTime: '2026-09-13T10:00:00Z',
      endTime: '2026-09-13T10:00:20Z',
    });
  };

  it('submitAnswer records and reports goal completion on the answer that masters the last required skill', async () => {
    const branch = goalBranch(null);
    const res = await masteringAnswer(branch);

    expect(res.stopReason).toBe('mastered');
    expect(res.summary?.goalCompleted).toEqual({
      goalId: 7,
      goalName: 'Web Developer',
    });
    expect(branch.goalCompletedAt).toBeInstanceOf(Date);
  });

  it('submitAnswer does not celebrate or re-date a goal that was already recorded as complete', async () => {
    const recorded = new Date('2026-09-01T00:00:00Z');
    const branch = goalBranch(recorded);
    const res = await masteringAnswer(branch);

    expect(res.summary?.goalCompleted).toBeNull();
    expect(branch.goalCompletedAt).toBe(recorded);
  });

  // docs/adr/0003: leaving mid-session keeps a draft that /session/start resumes
  it('startSession resumes the skill draft: same session, answered questions skipped, counts restored', async () => {
    branchRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 42,
      conceptMapState: practised(),
    });
    const withAnswers: any = {
      id: 50,
      branchId: 1,
      skillId: 1,
      endedAt: null,
      exerciseRelate: [{ exerciseId: 10, history: [{ isCorrect: true }] }],
    };
    const emptyVisit: any = {
      id: 51,
      branchId: 1,
      skillId: 1,
      endedAt: null,
      exerciseRelate: [],
    };
    sessionRepo.find.mockResolvedValue([withAnswers, emptyVisit]);

    const res = await service.startSession(42, { branchId: 1, skillId: 1 });

    expect(res.sessionId).toBe(50);
    expect(res.resumed).toBe(true);
    expect(res.answeredCount).toBe(1);
    expect(res.correctCount).toBe(1);
    expect(res.question.exerciseId).toBe(11); // 10 was answered in the draft
    expect(sessionRepo.create).not.toHaveBeenCalled();
    // the newer, empty visit is closed, leaving one draft per skill
    expect(emptyVisit.stopReason).toBe('abandoned');
    expect(emptyVisit.endedAt).toBeInstanceOf(Date);
    expect(withAnswers.endedAt).toBeNull();
  });

  it('startSession closes a draft with nothing left to ask and starts a new session', async () => {
    branchRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 42,
      conceptMapState: practised(),
    });
    exerciseRepo.find.mockResolvedValue([exercise(10)]);
    const exhausted: any = {
      id: 50,
      branchId: 1,
      skillId: 1,
      endedAt: null,
      exerciseRelate: [{ exerciseId: 10, history: [{ isCorrect: false }] }],
    };
    sessionRepo.find.mockResolvedValue([exhausted]);

    const res = await service.startSession(42, { branchId: 1, skillId: 1 });

    expect(exhausted.stopReason).toBe('exhausted');
    expect(res.sessionId).toBe(99);
    expect(res.resumed).toBe(false);
    expect(res.answeredCount).toBe(0);
    expect(res.question.exerciseId).toBe(10);
  });
});
