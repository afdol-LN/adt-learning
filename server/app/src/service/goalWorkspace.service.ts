import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import {
  GoalWorkspaceDto,
  PublishGoalResultDto,
  WorkspaceSkillDto,
} from 'src/dto/goalWorkspace.dto';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { Branch } from 'src/entity/branch.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { Status } from 'src/enums/status.enum';
import { SkillGraph } from 'src/libs/bkt/skillGraph';
import {
  evaluateReadiness,
  MIN_EXERCISES_PER_SKILL,
  ReadinessSkillInput,
  skillReadinessOf,
} from 'src/libs/goal/goalReadiness';

/**
 * read model ของหน้า Goal Workspace — รวม tree, จำนวนข้อ, ร่างที่ค้าง และผลตรวจความพร้อม
 * ไว้ในคำขอเดียว เพื่อให้หน้าจอโหลดใหม่ทั้งก้อนหลังทุกการเขียน (ไม่คำนวณซ้ำที่ frontend)
 *
 * หมายเหตุ: ต้องลงทะเบียนใน providers ของ AppModule ด้วย ไม่งั้นพังแบบเงียบ
 */
@Injectable()
export class goalWorkspaceService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(AiDraft)
    private readonly aiDraftRepository: Repository<AiDraft>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getWorkspace(goalId: number): Promise<GoalWorkspaceDto> {
    const goal = await this.goalRepository.findOne({
      where: { id: goalId },
      relations: { goalSkillRequire: true },
    });

    if (!goal) {
      throw new NotFoundException(`Goal ${goalId} not found`);
    }

    const allSkills = await this.skillRepository.find({
      relations: { skillPrequisite: true },
    });

    const requires = goal.goalSkillRequire ?? [];
    const closureIds = SkillGraph.getRelevantSkillIds(allSkills, requires);
    const skillIds = [...closureIds];

    const levelRequireBySkillId = new Map<number, number | null>(
      requires.map((r) => [r.skillId, r.levelRequire ?? null]),
    );

    const [branchCount, exercises, pendingDrafts, allGoals] = await Promise.all(
      [
        this.branchRepository.count({ where: { goalId } }),
        // In([]) ทำให้ SQL พัง จึงข้ามการ query ไปเลยเมื่อ closure ว่าง
        skillIds.length == 0
          ? Promise.resolve([] as Exercise[])
          : this.exerciseRepository.find({
              where: { skillId: In(skillIds), status: Status.ACTIVE },
              select: { id: true, skillId: true, skillLevel: true },
            }),

        this.aiDraftRepository.find({
          where: {
            entityType: AiDraftEntityType.EXERCISE,
            status: AiDraftStatus.PENDING,
          },
        }),
        this.goalRepository.find({ relations: { goalSkillRequire: true } }),
      ],
    );

    const exerciseCount = new Map<number, number>();
    const exerciseLevels = new Map<number, Set<number>>();
    for (const ex of exercises) {
      exerciseCount.set(ex.skillId, (exerciseCount.get(ex.skillId) ?? 0) + 1);
      const levels = exerciseLevels.get(ex.skillId) ?? new Set<number>();
      levels.add(ex.skillLevel);
      exerciseLevels.set(ex.skillId, levels);
    }

    // payload ของร่างเป็น jsonb — กรองใน JS แทนการ query ลงไปในคอลัมน์ jsonb
    const draftCount = new Map<number, number>();
    for (const draft of pendingDrafts) {
      const draftSkillId = Number(draft.payload?.skillId);
      if (!closureIds.has(draftSkillId)) continue;
      draftCount.set(draftSkillId, (draftCount.get(draftSkillId) ?? 0) + 1);
    }

    // skill นี้ถูกดึงเข้า closure ของ goal กี่ตัว (ทุกสถานะ)
    const goalCount = new Map<number, number>();
    for (const other of allGoals) {
      const otherClosure = SkillGraph.getRelevantSkillIds(
        allSkills,
        other.goalSkillRequire ?? [],
      );
      for (const id of otherClosure) {
        goalCount.set(id, (goalCount.get(id) ?? 0) + 1);
      }
    }

    const skillById = new Map(allSkills.map((s) => [s.skillId, s]));
    const skills: WorkspaceSkillDto[] = skillIds
      .map((skillId) => skillById.get(skillId))
      .filter((s): s is Skill => s !== undefined)
      .map((s) => {
        const activeExerciseCount = exerciseCount.get(s.skillId) ?? 0;
        return {
          skillId: s.skillId,
          skillCode: s.skillCode,
          skillsName: s.skillsName,
          tier: s.tier ?? null,
          status: s.status,
          required: levelRequireBySkillId.has(s.skillId),
          levelRequire: levelRequireBySkillId.get(s.skillId) ?? null,
          prerequisiteSkillIds: (s.skillPrequisite ?? []).map(
            (p) => p.prerequisiteSkillId,
          ),
          goalCount: goalCount.get(s.skillId) ?? 0,
          activeExerciseCount,
          activeExerciseLevels: [...(exerciseLevels.get(s.skillId) ?? [])],
          pendingDraftCount: draftCount.get(s.skillId) ?? 0,
          readiness: skillReadinessOf(activeExerciseCount),
        };
      });
    const readinessInput: ReadinessSkillInput[] = skills.map((s) => ({
      skillId: s.skillId,
      required: s.required,
      levelRequire: s.levelRequire,
      prerequisiteSkillIds: s.prerequisiteSkillIds,
      activeExerciseCount: s.activeExerciseCount,
      activeExerciseLevels: s.activeExerciseLevels,
    }));
    return {
      goal: {
        id: goal.id,
        goal: goal.goal,
        goalDescription: goal.goalDescription ?? null,
        status: goal.status,
      },
      branchCount,
      minExercisesPerSkill: MIN_EXERCISES_PER_SKILL,
      skills,
      readiness: evaluateReadiness(readinessInput),
    };
  }

  /**
   * เปิดใช้งาน goal ทั้งก้อน — คำนวณความพร้อมใหม่ที่ server เสมอ ไม่เชื่อค่าจาก client
   * เรียกซ้ำได้: ถ้าเปิดอยู่แล้วจะไม่เขียนอะไรและคืนรายการว่าง
   * ไม่แตะ exercise.status เพราะข้อ inactive แปลว่า "เลิกใช้ / ผู้สมัคร" ไม่ใช่ "ยังไม่เปิด"
   */
  async publish(goalId: number): Promise<PublishGoalResultDto> {
    const workspace = await this.getWorkspace(goalId);

    if (!workspace.readiness.ready) {
      throw new BadRequestException({
        message: `Goal ${goalId} is not ready to publish`,
        checks: workspace.readiness.checks.filter((c) => !c.passed),
      });
    }

    const activatedGoal = workspace.goal.status !== Status.ACTIVE;
    const activatedSkillIds = workspace.skills
      .filter((s) => s.status !== Status.ACTIVE)
      .map((s) => s.skillId);

    if (!activatedGoal && activatedSkillIds.length === 0) {
      return { activatedGoal: false, activatedSkillIds: [] };
    }

    await this.dataSource.transaction(async (manager) => {
      if (activatedGoal) {
        await manager.update(Goal, { id: goalId }, { status: Status.ACTIVE });
      }
      if (activatedSkillIds.length > 0) {
        await manager.update(
          Skill,
          { skillId: In(activatedSkillIds) },
          { status: Status.ACTIVE },
        );
      }
    });

    return { activatedGoal, activatedSkillIds };
  }
}
