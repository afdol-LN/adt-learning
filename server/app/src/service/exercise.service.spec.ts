import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { exerciseService } from './exercise.service';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { ExerciseChoice } from 'src/entity/exerciseAndSession/exerciseChoice.entity';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import { CreateExerciseDto } from 'src/dto/exerciseAndSession/exercise.dto';
import { Branch } from 'src/entity/branch.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { PretestSubmitDto } from 'src/dto/exerciseAndSession/pretestSubmit.dto';

describe('exerciseService', () => {
  let service: exerciseService;
  let exerciseRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let exerciseChoiceRepo: {
    create: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
  };
  let skillRepo: { findOne: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock; getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const baseChoiceDto: CreateExerciseDto = {
    description: 'Pick the even number',
    skillId: 1,
    skillLevel: 1,
    type: ExerciseType.CHOICE,
    expectTime: 30,
    choices: [
      { script: '1', isAnswer: false },
      { script: '2', isAnswer: true },
      { script: '3', isAnswer: false },
      { script: '4', isAnswer: false },
    ],
  };

  beforeEach(async () => {
    exerciseRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 10, ...entity })),
      findOne: jest.fn(),
    };
    exerciseChoiceRepo = {
      create: jest.fn((data) => data),
      delete: jest.fn(() => Promise.resolve({})),
      save: jest.fn((entities: any[]) =>
        Promise.resolve(entities.map((e, i) => ({ id: i + 1, ...e }))),
      ),
    };
    skillRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ skillId: 1, skillsName: 'Algebra' }),
      ),
    };
    manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 10, ...entity })),
      getRepository: jest.fn(() => exerciseChoiceRepo),
    };
    dataSource = {
      transaction: jest.fn((cb) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        exerciseService,
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Goal), useValue: {} },
        { provide: getRepositoryToken(GoalSkillRequire), useValue: {} },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<exerciseService>(exerciseService);
  });

  it('creates a CHOICE exercise with 4 choices', async () => {
    exerciseRepo.findOne.mockResolvedValue({
      id: 10,
      description: baseChoiceDto.description,
      type: ExerciseType.CHOICE,
      exerciseChoices: [
        { id: 1, script: '1', isAnswer: false },
        { id: 2, script: '2', isAnswer: true },
        { id: 3, script: '3', isAnswer: false },
        { id: 4, script: '4', isAnswer: false },
      ],
    });

    const result = await service.createExercise(baseChoiceDto);

    expect(skillRepo.findOne).toHaveBeenCalledWith({ where: { skillId: 1 } });
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalled();
    expect(exerciseChoiceRepo.delete).toHaveBeenCalledWith({ exerciseId: 10 });

    const savedChoices = exerciseChoiceRepo.save.mock.calls[0][0];
    expect(savedChoices).toHaveLength(4);
    expect(savedChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exerciseId: 10,
          script: '2',
          isAnswer: true,
        }),
      ]),
    );
    expect(result.exerciseChoices).toHaveLength(4);
  });

  it('rejects a CHOICE exercise with no correct answer', async () => {
    const dto: CreateExerciseDto = {
      ...baseChoiceDto,
      choices: baseChoiceDto.choices!.map((c) => ({ ...c, isAnswer: false })),
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a CHOICE exercise with more than one correct answer', async () => {
    const dto: CreateExerciseDto = {
      ...baseChoiceDto,
      choices: baseChoiceDto.choices!.map((c) => ({ ...c, isAnswer: true })),
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a CHOICE exercise with fewer than 2 choices', async () => {
    const dto: CreateExerciseDto = {
      ...baseChoiceDto,
      choices: [{ script: 'only one', isAnswer: true }],
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a CHOICE exercise with a blank choice script', async () => {
    const dto: CreateExerciseDto = {
      ...baseChoiceDto,
      choices: [
        { script: '2', isAnswer: true },
        { script: '   ', isAnswer: false },
      ],
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a CHOICE exercise where isAnswer is not a strict boolean', async () => {
    const dto: CreateExerciseDto = {
      ...baseChoiceDto,
      choices: [
        { script: '1', isAnswer: 'false' as unknown as boolean },
        { script: '2', isAnswer: 'true' as unknown as boolean },
      ],
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when the referenced skill does not exist', async () => {
    skillRepo.findOne.mockResolvedValue(null);

    await expect(service.createExercise(baseChoiceDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a FILL_IN_BLANK exercise without an answer', async () => {
    const dto: CreateExerciseDto = {
      description: 'Type the missing word',
      skillId: 1,
      skillLevel: 1,
      type: ExerciseType.FILL_IN_BLANK,
      expectTime: 30,
    };

    await expect(service.createExercise(dto)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('exerciseService.submitPretest', () => {
  let service: exerciseService;
  let branch: any;
  let userprofile: any;

  const dto: PretestSubmitDto = {
    branchId: 7,
    answers: [
      {
        exerciseId: 100,
        isCorrect: true,
        chosenAnswer: '2',
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T00:00:20.000Z',
      },
    ],
  };

  beforeEach(async () => {
    branch = {
      id: 7,
      userId: 42,
      goalId: 3,
      expForGoal: 3,
      isAlreadyPretest: false,
      conceptMapState: null,
    };
    userprofile = { id: 42, year: 1, major: { isAboutCs: false } };

    const exerciseRepoInTx = {
      find: jest.fn(() =>
        Promise.resolve([{ id: 100, skillId: 1, expectTime: 30 }]),
      ),
    };
    const goalSkillRequireRepoInTx = {
      find: jest.fn(() => Promise.resolve([{ goalId: 3, skillId: 1 }])),
    };
    const skillRepoInTx = {
      find: jest.fn(() =>
        Promise.resolve([{ skillId: 1, tier: 'T1', pL0: 0.25 }]),
      ),
    };

    let nextId = 0;
    const manager = {
      findOne: jest.fn((entity: any) =>
        Promise.resolve(entity === Branch ? branch : userprofile),
      ),
      create: jest.fn((_entity: any, data: any) => ({ ...(data ?? {}) })),
      save: jest.fn((entity: any) => {
        if (entity && entity.id === undefined) entity.id = ++nextId;
        return Promise.resolve(entity);
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === Exercise) return exerciseRepoInTx;
        if (entity === GoalSkillRequire) return goalSkillRequireRepoInTx;
        return skillRepoInTx;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        exerciseService,
        { provide: getRepositoryToken(Exercise), useValue: {} },
        { provide: getRepositoryToken(Goal), useValue: {} },
        { provide: getRepositoryToken(GoalSkillRequire), useValue: {} },
        { provide: getRepositoryToken(Skill), useValue: {} },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn((cb: any) => cb(manager)) },
        },
      ],
    }).compile();

    service = module.get<exerciseService>(exerciseService);
  });

  it('writes pretest mastery into the branch, not the user profile', async () => {
    await service.submitPretest(42, dto);

    expect(branch.conceptMapState['1']).toEqual(
      expect.objectContaining({ attemptCount: 1 }),
    );
    expect(branch.conceptMapState['1'].pL).toBeGreaterThan(0);
    expect(userprofile.conceptMapState).toBeUndefined();
    expect(branch.isAlreadyPretest).toBe(true);
  });

  it('never clobbers an existing entry in the branch state', async () => {
    branch.conceptMapState = {
      '1': { pL: 0.8, progress: 84, status: 'unlocked', attemptCount: 9 },
    };

    await service.submitPretest(42, dto);

    expect(branch.conceptMapState['1'].pL).toBe(0.8);
    expect(branch.conceptMapState['1'].attemptCount).toBe(9);
  });
});
