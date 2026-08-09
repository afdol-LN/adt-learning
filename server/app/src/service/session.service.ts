import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { SessionAndExercise } from 'src/entity/exerciseAndSession/sessionAndExercise.entity';
import { History } from 'src/entity/history.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { Status } from 'src/enums/status.enum';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import { SkillGraph } from 'src/libs/bkt/skillGraph';
import { SkillRecommender } from 'src/libs/bkt/skillRecommendation';
import { MasteryState, ConceptMapState } from 'src/libs/bkt/masteryState';
import { QuestionSelector, CandidateExercise } from 'src/libs/bkt/questionSelection';
import { ktService } from './kt.service';
import { AttemptRequestDto } from 'src/dto/kt/kt.dto';
import {
  NextQuestionDto,
  RecommendedSkillDto,
  StartSessionDto,
  StartSessionResponseDto,
  SubmitAnswerDto,
  SubmitAnswerResponseDto,
} from 'src/dto/exerciseAndSession/session.dto';

const SESSION_QUESTION_LIMIT = 8;

@Injectable()
export class sessionService {
  constructor(
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Skill) private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Exercise) private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(Session) private readonly sessionRepository: Repository<Session>,
    @InjectRepository(SessionAndExercise)
    private readonly sessionAndExerciseRepository: Repository<SessionAndExercise>,
    @InjectRepository(History) private readonly historyRepository: Repository<History>,
    @InjectRepository(Userprofile)
    private readonly userprofileRepository: Repository<Userprofile>,
    private readonly dataSource: DataSource,
    private readonly ktService: ktService,
  ) {}

  private async loadOwnedBranch(branchId: number, userId: number): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      relations: { goal: { goalSkillRequire: true } },
    });
    if (!branch) throw new NotFoundException(`Branch ${branchId} not found`);
    if (branch.userId !== userId) {
      throw new ForbiddenException('Branch does not belong to the user');
    }
    return branch;
  }

  private pLFor(
    conceptMapState: ConceptMapState,
    skillId: number,
    fallbackPL0: number,
  ): number {
    return MasteryState.getEntry(conceptMapState, skillId, fallbackPL0).pL;
  }

  async recommendNextSkill(
    branchId: number,
    userId: number,
  ): Promise<RecommendedSkillDto | null> {
    const branch = await this.loadOwnedBranch(branchId, userId);
    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    const conceptMapState: ConceptMapState = userprofile?.conceptMapState ?? {};

    const allSkills = await this.skillRepository.find({
      relations: { skillPrequisite: true },
    });
    const relevantSkillIds = SkillGraph.getRelevantSkillIds(
      allSkills,
      branch.goal?.goalSkillRequire || [],
    );
    const skillById = new Map(allSkills.map((s) => [s.skillId, s]));

    const candidates = [...relevantSkillIds]
      .map((skillId) => skillById.get(skillId))
      .filter((skill): skill is Skill => !!skill)
      .filter((skill) => {
        const prereqs = skill.skillPrequisite || [];
        return prereqs.every(
          (p) =>
            this.pLFor(conceptMapState, p.prerequisiteSkillId, skillById.get(p.prerequisiteSkillId)?.pL0 ?? 0.25) >=
            SkillRecommender.MASTERY_THRESHOLD,
        );
      })
      .map((skill) => ({
        skillId: skill.skillId,
        tier: skill.tier,
        pL: this.pLFor(conceptMapState, skill.skillId, skill.pL0),
      }));

    const top = SkillRecommender.rank(candidates);
    if (!top) return null;

    const skill = skillById.get(top.skillId)!;
    return {
      skillId: skill.skillId,
      skillCode: skill.skillCode,
      skillsName: skill.skillsName,
      tier: skill.tier,
      pL: top.pL,
    };
  }

  private buildQuestionDto(exercise: Exercise): NextQuestionDto {
    return {
      exerciseId: exercise.id,
      description: exercise.description,
      type: exercise.type,
      expectTime: exercise.expectTime ?? null,
      choices:
        exercise.type === ExerciseType.CHOICE
          ? (exercise.exerciseChoices || []).map((c) => ({
              id: c.id,
              script: c.script,
            }))
          : undefined,
    };
  }

  private async unansweredCandidates(
    skillId: number,
    excludeExerciseIds: number[],
  ): Promise<{ exercises: Exercise[]; candidates: CandidateExercise[] }> {
    const exercises = await this.exerciseRepository.find({
      where: { skillId, status: Status.ACTIVE },
      relations: { exerciseChoices: true },
    });
    const remaining = exercises.filter(
      (e) => !excludeExerciseIds.includes(e.id),
    );
    return {
      exercises: remaining,
      candidates: remaining.map((e) => ({ id: e.id, pG: e.pG, pS: e.pS })),
    };
  }

  async startSession(
    userId: number,
    dto: StartSessionDto,
  ): Promise<StartSessionResponseDto> {
    const branch = await this.loadOwnedBranch(dto.branchId, userId);
    const skill = await this.skillRepository.findOne({
      where: { skillId: dto.skillId },
    });
    if (!skill) throw new NotFoundException(`Skill ${dto.skillId} not found`);

    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    const conceptMapState: ConceptMapState = userprofile?.conceptMapState ?? {};
    const pL = this.pLFor(conceptMapState, skill.skillId, skill.pL0);

    const { exercises, candidates } = await this.unansweredCandidates(
      skill.skillId,
      [],
    );
    const selectedId = QuestionSelector.selectNext(candidates, pL);
    if (selectedId === null) {
      throw new BadRequestException(
        `No exercises available for skill ${skill.skillId}`,
      );
    }
    const selectedExercise = exercises.find((e) => e.id === selectedId)!;

    const session = this.sessionRepository.create({
      branchId: branch.id,
      skillId: skill.skillId,
    });
    const savedSession = await this.sessionRepository.save(session);

    return {
      sessionId: savedSession.id,
      skillId: skill.skillId,
      pL,
      question: this.buildQuestionDto(selectedExercise),
    };
  }

  async submitAnswer(
    userId: number,
    sessionId: number,
    dto: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: { branch: true },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.branch.userId !== userId) {
      throw new ForbiddenException('Session does not belong to the user');
    }
    if (session.endedAt) {
      throw new BadRequestException('Session has already ended');
    }

    const exercise = await this.exerciseRepository.findOne({
      where: { id: dto.exerciseId },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise ${dto.exerciseId} not found`);
    }
    if (exercise.skillId !== session.skillId) {
      throw new BadRequestException(
        `Exercise ${dto.exerciseId} does not belong to this session's skill`,
      );
    }

    const skill = await this.skillRepository.findOne({
      where: { skillId: session.skillId },
      relations: { skillPrequisite: true },
    });
    if (!skill) throw new NotFoundException(`Skill ${session.skillId} not found`);

    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    const conceptMapState: ConceptMapState = userprofile?.conceptMapState ?? {};
    const currentEntry = MasteryState.getEntry(
      conceptMapState,
      skill.skillId,
      skill.pL0,
    );

    const responseTime =
      (new Date(dto.endTime).getTime() - new Date(dto.startTime).getTime()) /
      1000;
    const expectTimeForRatio = exercise.expectTime ?? responseTime;

    const attemptPayload: AttemptRequestDto = {
      pLCurrent: currentEntry.pL,
      pT: skill.pT,
      pG: exercise.pG,
      pS: exercise.pS,
      isCorrect: dto.isCorrect,
      responseTime,
      expectTime: expectTimeForRatio,
    };
    const attemptResult = await this.ktService.submitAttempt(attemptPayload);
    if (attemptResult.isError || !attemptResult.data) {
      throw new BadRequestException(
        attemptResult.errorMessage || 'KT engine failed to process the attempt',
      );
    }
    const pLNext = attemptResult.data.pLNext;

    await this.dataSource.transaction(async (manager) => {
      const sessionAndExerciseRepo = manager.getRepository(SessionAndExercise);
      const sessionAndExercise = manager.create(SessionAndExercise, {
        sessionId: session.id,
        exerciseId: exercise.id,
      });
      const savedSessionAndExercise = await sessionAndExerciseRepo.save(sessionAndExercise);

      const history = manager.create(History, {
        branchId: session.branchId,
        sessionAndExerciseId: savedSessionAndExercise.id,
        isCorrect: dto.isCorrect,
        isPretest: false,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        chosenAnswer: dto.chosenAnswer,
        pL: pLNext,
      });
      await manager.save(history);

      if (userprofile) {
        const newEntry = MasteryState.buildEntry(
          pLNext,
          currentEntry.attemptCount + 1,
        );
        userprofile.conceptMapState = {
          ...conceptMapState,
          [String(skill.skillId)]: newEntry,
        };
        await manager.save(userprofile);
      }
    });

    const answeredExerciseIds = [
      ...(
        await this.sessionAndExerciseRepository.find({
          where: { sessionId: session.id },
        })
      ).map((se) => se.exerciseId),
      exercise.id,
    ];

    let stopReason: 'mastered' | 'completed' | 'exhausted' | null = null;
    if (pLNext >= MasteryState.MASTERY_THRESHOLD) {
      stopReason = 'mastered';
    } else if (answeredExerciseIds.length >= SESSION_QUESTION_LIMIT) {
      stopReason = 'completed';
    } else {
      const { candidates } = await this.unansweredCandidates(
        skill.skillId,
        answeredExerciseIds,
      );
      if (candidates.length === 0) stopReason = 'exhausted';
    }

    if (stopReason) {
      session.endedAt = new Date();
      session.stopReason = stopReason;
      await this.sessionRepository.save(session);

      const nextRecommendation = await this.recommendNextSkill(
        session.branchId,
        userId,
      );

      return {
        isCorrect: dto.isCorrect,
        pL: pLNext,
        nextQuestion: null,
        sessionEnded: true,
        stopReason,
        summary: {
          pLBefore: currentEntry.pL,
          pLAfter: pLNext,
          newlyUnlockedSkills: [],
          nextRecommendation,
        },
      };
    }

    const { exercises, candidates } = await this.unansweredCandidates(
      skill.skillId,
      answeredExerciseIds,
    );
    const nextId = QuestionSelector.selectNext(candidates, pLNext);
    const nextExercise = exercises.find((e) => e.id === nextId)!;

    return {
      isCorrect: dto.isCorrect,
      pL: pLNext,
      nextQuestion: this.buildQuestionDto(nextExercise),
      sessionEnded: false,
      stopReason: null,
    };
  }
}
