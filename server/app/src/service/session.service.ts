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
import {
  NextQuestionDto,
  RecommendedSkillDto,
  StartSessionDto,
  StartSessionResponseDto,
} from 'src/dto/exerciseAndSession/session.dto';

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
}
