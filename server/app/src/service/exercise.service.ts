import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseService } from 'src/service/base.service';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { EntityManager, In, Repository } from 'typeorm';
import { ExerciseChoice } from 'src/entity/exerciseAndSession/exerciseChoice.entity';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Status } from 'src/enums/status.enum';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import {
  CreateExerciseDto,
  UpdateExerciseDto,
} from 'src/dto/exerciseAndSession/exercise.dto';
import { ExerciseChoiceInputDto } from 'src/dto/exerciseAndSession/exerciseChoice.dto';
import { DataSource } from 'typeorm';
import { PretestSubmitDto } from 'src/dto/exerciseAndSession/pretestSubmit.dto';
import { Branch } from 'src/entity/branch.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { SessionAndExercise } from 'src/entity/exerciseAndSession/sessionAndExercise.entity';
import { History } from 'src/entity/history.entity';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class exerciseService extends BaseService<Exercise> {
  private readonly logger = new Logger(exerciseService.name);
  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalSkillRequire)
    private readonly goalSkillRequireRepository: Repository<GoalSkillRequire>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    private readonly dataSource: DataSource,
  ) {
    super(exerciseRepository);
  }

  async submitPretest(userId: number, dto: PretestSubmitDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const branch = await manager.findOne(Branch, {
        where: { id: dto.branchId },
      });

      if (!branch) {
        throw new NotFoundException(`Branch ${dto.branchId} not found`);
      }

      if (branch.userId !== userId) {
        throw new ForbiddenException('Branch does not belong to the user');
      }

      const session = manager.create(Session, {});
      const savedSession = await manager.save(session);

      for (const answer of dto.answers) {
        const sessionAndExercise = manager.create(SessionAndExercise, {
          sessionId: savedSession.id,
          exerciseId: answer.exerciseId,
        });
        const savedSessionAndExercise = await manager.save(sessionAndExercise);

        const history = manager.create(History, {
          branchId: branch.id,
          sessionAndExerciseId: savedSessionAndExercise.id,
          isCorrect: answer.isCorrect,
          isPretest: true,
          startTime: new Date(answer.startTime),
          endTime: new Date(answer.endTime),
          chosenAnswer: answer.chosenAnswer,
        });
        await manager.save(history);
      }

      branch.isAlreadyPretest = true;
      await manager.save(branch);
    });
  }

  async findAll(): Promise<Exercise[]> {
    return this.exerciseRepository.find({
      relations: { skill: true },
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Exercise> {
    const result = await this.exerciseRepository.findOne({
      where: { id },
      relations: { skill: true, exerciseChoices: true },
    });
    if (!result) {
      throw new NotFoundException(`Exercise ${id} not found`);
    }
    return result;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    existing.status = Status.INACTIVE;
    await this.exerciseRepository.save(existing);
  }

  async createExercise(dto: CreateExerciseDto): Promise<Exercise> {
    await this.validateSkillExists(dto.skillId);
    this.validateExercisePayload(dto.type, dto.fillInBlank, dto.choices);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const exercise = manager.create(Exercise, {
        description: dto.description,
        skillId: dto.skillId,
        skillLevel: dto.skillLevel,
        level: dto.skillLevel,
        type: dto.type,
        status: dto.status ?? Status.ACTIVE,
        expectTime: dto.expectTime,
        fillInBlank:
          dto.type === ExerciseType.FILL_IN_BLANK ? dto.fillInBlank : undefined,
        isCasesensitive:
          dto.type === ExerciseType.FILL_IN_BLANK
            ? (dto.isCasesensitive ?? 'NO')
            : 'NO',
      });
      const saved = await manager.save(exercise);

      if (dto.type === ExerciseType.CHOICE && dto.choices) {
        await this.replaceChoices(saved.id, dto.choices, manager);
      }

      return saved.id;
    });

    return this.findOne(savedId);
  }

  async updateExercise(id: number, dto: UpdateExerciseDto): Promise<Exercise> {
    const existing = await this.findOne(id);

    if (dto.skillId !== undefined) {
      await this.validateSkillExists(dto.skillId);
    }

    const nextType = dto.type ?? existing.type;
    const nextFillInBlank =
      dto.fillInBlank ?? existing.fillInBlank ?? undefined;
    const nextChoices =
      dto.choices ??
      (nextType === existing.type ? existing.exerciseChoices : undefined);
    this.validateExercisePayload(nextType, nextFillInBlank, nextChoices);

    existing.description = dto.description ?? existing.description;
    existing.skillId = dto.skillId ?? existing.skillId;
    existing.skillLevel = dto.skillLevel ?? existing.skillLevel;
    existing.level = dto.skillLevel ?? existing.level;
    existing.type = nextType;
    existing.status = dto.status ?? existing.status;
    existing.expectTime = dto.expectTime ?? existing.expectTime;
    existing.fillInBlank =
      nextType === ExerciseType.FILL_IN_BLANK
        ? (nextFillInBlank ?? null)
        : null;
    existing.isCasesensitive =
      nextType === ExerciseType.FILL_IN_BLANK
        ? (dto.isCasesensitive ?? existing.isCasesensitive ?? 'NO')
        : 'NO';

    await this.dataSource.transaction(async (manager) => {
      await manager.save(existing);

      if (nextType === ExerciseType.CHOICE && dto.choices) {
        await this.replaceChoices(id, dto.choices, manager);
      } else if (
        nextType === ExerciseType.FILL_IN_BLANK &&
        existing.exerciseChoices?.length
      ) {
        await manager.getRepository(ExerciseChoice).delete({ exerciseId: id });
      }
    });

    return this.findOne(id);
  }

  private async replaceChoices(
    exerciseId: number,
    choices: ExerciseChoiceInputDto[],
    manager: EntityManager,
  ): Promise<void> {
    const choiceRepo = manager.getRepository(ExerciseChoice);
    await choiceRepo.delete({ exerciseId });
    const choiceEntities = choices.map((choice) =>
      choiceRepo.create({
        exerciseId,
        script: choice.script,
        isAnswer: choice.isAnswer,
      }),
    );
    await choiceRepo.save(choiceEntities);
  }

  private async validateSkillExists(skillId: number): Promise<void> {
    const skill = await this.skillRepository.findOne({ where: { skillId } });
    if (!skill) {
      throw new BadRequestException(`Skill ${skillId} does not exist`);
    }
  }

  private validateExercisePayload(
    type: ExerciseType,
    fillInBlank: string | undefined,
    choices: ExerciseChoiceInputDto[] | undefined,
  ): void {
    if (type === ExerciseType.FILL_IN_BLANK) {
      if (!fillInBlank || fillInBlank.trim() === '') {
        throw new BadRequestException(
          'fillInBlank answer is required for FILL_IN_BLANK exercises',
        );
      }
    } else if (type === ExerciseType.CHOICE) {
      if (!choices || choices.length < 2) {
        throw new BadRequestException(
          'At least 2 choices are required for CHOICE exercises',
        );
      }
      const hasEmptyScript = choices.some(
        (choice) => !choice.script || choice.script.trim() === '',
      );
      if (hasEmptyScript) {
        throw new BadRequestException(
          'Each choice must have a non-empty script',
        );
      }
      const correctCount = choices.filter(
        (choice) => choice.isAnswer === true,
      ).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          'Exactly one correct choice is required for CHOICE exercises',
        );
      }
    } else {
      throw new BadRequestException(`Unsupported exercise type: ${type}`);
    }
  }

  async findPretestByGoal(
    goalId?: number | string,
    userId?: number | string,
    level?: number,
  ) {
    this.logger.log(
      `Fetching pretest exercises for goalId=${goalId}, userId=${userId}, level=${level}`,
    );

    let skillIds: number[] = [];
    if (goalId !== undefined && goalId !== null && goalId !== '') {
      let numericGoalId = !isNaN(Number(goalId)) ? Number(goalId) : -1;
      if (numericGoalId === -1 && typeof goalId === 'string') {
        const foundGoal = await this.goalRepository.findOne({
          where: [{ goalDescription: goalId }, { goal: goalId }],
        });
        if (foundGoal) {
          numericGoalId = foundGoal.id;
        }
      }
      if (numericGoalId !== -1) {
        const reqs = await this.goalSkillRequireRepository.find({
          where: { goalId: numericGoalId },
        });
        skillIds = reqs.map((r) => r.skillId);
      }
    }

    let choiceExercises: Exercise[] = [];
    let blankExercises: Exercise[] = [];

    if (skillIds.length > 0) {
      const allMatch = await this.exerciseRepository.find({
        where: {
          skillId: In(skillIds),
          status: Status.ACTIVE,
        },
        relations: { exerciseChoices: true, skill: true },
      });
      choiceExercises = allMatch.filter(
        (ex) => !ex.fillInBlank || ex.fillInBlank.trim() === '',
      );
      blankExercises = allMatch.filter(
        (ex) => ex.fillInBlank && ex.fillInBlank.trim() !== '',
      );
    }

    if (choiceExercises.length === 0 && blankExercises.length === 0) {
      this.logger.warn(
        `No exercises found for goalId=${goalId} (or no skills mapped). Falling back to active DB exercises.`,
      );
      const allExercises = await this.exerciseRepository.find({
        where: { status: Status.ACTIVE },
        relations: { exerciseChoices: true, skill: true },
      });
      choiceExercises = allExercises.filter(
        (ex) => !ex.fillInBlank || ex.fillInBlank.trim() === '',
      );
      blankExercises = allExercises.filter(
        (ex) => ex.fillInBlank && ex.fillInBlank.trim() !== '',
      );
    }

    if (choiceExercises.length === 0 && blankExercises.length === 0) {
      this.logger.warn(
        'DB has 0 exercises. Returning mock fallback choice & fill-in-blank exercises for pretest.',
      );
      return this.getMockPretestExercises();
    }

    const targetTotal = 5;
    const resultPool: Exercise[] = [];
    const shuffledChoices = [...choiceExercises].sort(
      () => 0.5 - Math.random(),
    );
    const shuffledBlanks = [...blankExercises].sort(() => 0.5 - Math.random());

    let cIdx = 0;
    let bIdx = 0;
    while (
      resultPool.length < targetTotal &&
      (cIdx < shuffledChoices.length || bIdx < shuffledBlanks.length)
    ) {
      const pickChoice = Math.random() < 0.5;
      if (pickChoice && cIdx < shuffledChoices.length) {
        resultPool.push(shuffledChoices[cIdx++]);
      } else if (!pickChoice && bIdx < shuffledBlanks.length) {
        resultPool.push(shuffledBlanks[bIdx++]);
      } else if (cIdx < shuffledChoices.length) {
        resultPool.push(shuffledChoices[cIdx++]);
      } else if (bIdx < shuffledBlanks.length) {
        resultPool.push(shuffledBlanks[bIdx++]);
      }
    }

    const selected = resultPool.sort(() => 0.5 - Math.random());

    return selected.map((ex) => {
      const isBlank = Boolean(ex.fillInBlank && ex.fillInBlank.trim() !== '');
      const choices = ex.exerciseChoices || [];
      const answerChoiceIndex = choices.findIndex((c) => c.isAnswer);
      return {
        id: ex.id,
        skillId: ex.skillId,
        skillName: ex.skill?.skillsName || `Skill ${ex.skillId}`,
        level: ex.level || 1,
        description: ex.description,
        text: ex.description,
        type: isBlank ? 'FILL_IN_BLANK' : 'CHOICE',
        fillInBlank: isBlank ? ex.fillInBlank : null,
        isCasesensitive: ex.isCasesensitive || 'NO',
        exerciseChoices: choices,
        choices: choices.map((c) => c.script),
        answer: isBlank ? ex.fillInBlank : answerChoiceIndex,
      };
    });
  }

  private getMockPretestExercises() {
    return [
      {
        id: 101,
        skillId: 1,
        skillName: 'Python Fundamentals',
        level: 1,
        description: 'ผลลัพธ์ของโค้ด x = 10; y = 3; print(x % y) คืออะไร?',
        text: 'ผลลัพธ์ของโค้ด x = 10; y = 3; print(x % y) คืออะไร?',
        type: 'CHOICE',
        fillInBlank: null,
        isCasesensitive: 'NO',
        exerciseChoices: [
          { id: 1, script: '0', isAnswer: false },
          { id: 2, script: '1', isAnswer: true },
          { id: 3, script: '3', isAnswer: false },
          { id: 4, script: '3.33', isAnswer: false },
        ],
        choices: ['0', '1', '3', '3.33'],
        answer: 1,
      },
      {
        id: 102,
        skillId: 2,
        skillName: 'Control Flow',
        level: 2,
        description:
          'คำสั่งใน Python สำหรับวนลูปที่มีจำนวนรอบแน่นอน คือคำสั่งใด (พิมพ์คำสั่ง 1 คำ)?',
        text: 'คำสั่งใน Python สำหรับวนลูปที่มีจำนวนรอบแน่นอน คือคำสั่งใด (พิมพ์คำสั่ง 1 คำ)?',
        type: 'FILL_IN_BLANK',
        fillInBlank: 'for',
        isCasesensitive: 'NO',
        exerciseChoices: [],
        choices: [],
        answer: 'for',
      },
      {
        id: 103,
        skillId: 3,
        skillName: 'Functions',
        level: 3,
        description:
          'ฟังก์ชัน mystery(n) ที่คืนค่า n * mystery(n-1) เมื่อ n <= 1 คืนค่า 1 ถ้าเรียก mystery(4) จะได้ผลลัพธ์เท่าใด?',
        text: 'ฟังก์ชัน mystery(n) ที่คืนค่า n * mystery(n-1) เมื่อ n <= 1 คืนค่า 1 ถ้าเรียก mystery(4) จะได้ผลลัพธ์เท่าใด?',
        type: 'CHOICE',
        fillInBlank: null,
        isCasesensitive: 'NO',
        exerciseChoices: [
          { id: 5, script: '12', isAnswer: false },
          { id: 6, script: '24', isAnswer: true },
          { id: 7, script: '6', isAnswer: false },
          { id: 8, script: '16', isAnswer: false },
        ],
        choices: ['12', '24', '6', '16'],
        answer: 1,
      },
      {
        id: 104,
        skillId: 4,
        skillName: 'Data Structures',
        level: 2,
        description:
          'เมธอดที่ใช้สำหรับเพิ่มสมาชิกใหม่ต่อท้าย List ใน Python คือคำสั่งใด (พิมพ์ชื่อเมธอด)?',
        text: 'เมธอดที่ใช้สำหรับเพิ่มสมาชิกใหม่ต่อท้าย List ใน Python คือคำสั่งใด (พิมพ์ชื่อเมธอด)?',
        type: 'FILL_IN_BLANK',
        fillInBlank: 'append',
        isCasesensitive: 'NO',
        exerciseChoices: [],
        choices: [],
        answer: 'append',
      },
      {
        id: 105,
        skillId: 5,
        skillName: 'Sort & Search',
        level: 4,
        description: 'Binary Search มีเงื่อนไขสำคัญอะไรในการใช้งาน?',
        text: 'Binary Search มีเงื่อนไขสำคัญอะไรในการใช้งาน?',
        type: 'CHOICE',
        fillInBlank: null,
        isCasesensitive: 'NO',
        exerciseChoices: [
          { id: 9, script: 'Array ไม่จำเป็นต้องเรียงลำดับ', isAnswer: false },
          {
            id: 10,
            script: 'Array ต้องเรียงลำดับ (Sorted) มาก่อนเสมอ',
            isAnswer: true,
          },
          {
            id: 11,
            script: 'Array ต้องมีเฉพาะตัวเลขจำนวนเต็มเท่านั้น',
            isAnswer: false,
          },
          { id: 12, script: 'ใช้ได้เฉพาะกับ Linked List', isAnswer: false },
        ],
        choices: [
          'Array ไม่จำเป็นต้องเรียงลำดับ',
          'Array ต้องเรียงลำดับ (Sorted) มาก่อนเสมอ',
          'Array ต้องมีเฉพาะตัวเลขจำนวนเต็มเท่านั้น',
          'ใช้ได้เฉพาะกับ Linked List',
        ],
        answer: 1,
      },
    ];
  }
}
