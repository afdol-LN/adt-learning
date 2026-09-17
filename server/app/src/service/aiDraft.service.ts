import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';

import { AiDraft } from 'src/entity/aiDraft.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { Status } from 'src/enums/status.enum';
import {
  FindDraftsQueryDto,
  GenerateDraftDto,
  GenerateDraftResultDto,
} from 'src/dto/aiDraft.dto';
import { CreateExerciseDto } from 'src/dto/exerciseAndSession/exercise.dto';
import { CreateSkillWithPrerequisiteDto } from 'src/dto/skill.dto';
import { CreateGoalWithSkillRequireDto } from 'src/dto/goal.dto';
import { LlmClient } from 'src/libs/llm/llm.client';
import {
  buildPrompt,
  ExistingExerciseItem,
  selectPromptExercises,
  SkillContextItem,
} from 'src/libs/llm/prompt.builder';
import {
  exerciseDuplicateKey,
  ExerciseSimilarity,
  extractJsonArray,
  RejectedDraft,
  validateExerciseDrafts,
  validateGoalDrafts,
  validateSkillDrafts,
} from 'src/libs/llm/draft.validator';
import { exerciseService } from './exercise.service';
import { skillService } from './skill.service';
import { goalService } from './goal.service';

/** กันค่า token บาน และกัน response ยาวจน LLM ตัดกลางคัน */
const MAX_GENERATE_COUNT = 20;
const SAMPLE_LIMIT = 5;

@Injectable()
export class aiDraftService {
  private readonly logger = new Logger(aiDraftService.name);

  constructor(
    @InjectRepository(AiDraft)
    private readonly aiDraftRepository: Repository<AiDraft>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly llmClient: LlmClient,
    private readonly exerciseSvc: exerciseService,
    private readonly skillSvc: skillService,
    private readonly goalSvc: goalService,
  ) {}

  // ───────────────────────────── generate ─────────────────────────────

  async generate(
    dto: GenerateDraftDto,
    userId: number | null,
  ): Promise<GenerateDraftResultDto> {
    const entityType = dto.entityType;
    if (!Object.values(AiDraftEntityType).includes(entityType)) {
      throw new BadRequestException(
        `entityType ต้องเป็น exercise, skill หรือ goal (ได้ ${String(entityType)})`,
      );
    }

    const count = Number(dto.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATE_COUNT) {
      throw new BadRequestException(
        `จำนวนต้องเป็นจำนวนเต็ม 1-${MAX_GENERATE_COUNT}`,
      );
    }

    const skills = await this.loadSkillContext();
    const samples = await this.loadSamples(entityType, dto.skillId);
    // ทั้งคลังใช้ตรวจซ้ำใน validator; prompt ได้เฉพาะ skill ที่เลือกแบบไม่ตัด
    const existingExercises = await this.loadExistingExercises(entityType);
    const promptExercises = selectPromptExercises(
      existingExercises,
      dto.skillId,
    );

    const { system, user } = buildPrompt({
      entityType,
      count,
      instruction: dto.instruction,
      skills,
      samples,
      existingExercises: promptExercises.items,
      existingExercisesScope: promptExercises.scope,
      skillId: dto.skillId,
      skillLevel: dto.skillLevel,
      exerciseType: dto.exerciseType,
    });

    const completion = await this.llmClient.complete(system, user, {
      maxTokens: Math.min(1024 + count * 400, 8192),
    });

    const { valid, rejected, similarities } = this.validateByType(
      entityType,
      extractJsonArray(completion.text),
      skills,
      dto,
      existingExercises,
    );

    if (valid.length === 0) {
      throw new BadRequestException(
        `LLM ไม่ได้สร้างรายการที่ใช้ได้เลย (ถูกคัดออก ${rejected.length} รายการ: ${rejected
          .map((r) => r.reason)
          .join('; ')})`,
      );
    }

    const batchId = randomUUID();
    const generateParams = {
      skillId: dto.skillId,
      skillLevel: dto.skillLevel,
      exerciseType: dto.exerciseType,
    };

    const rows = valid.map((payload, index) =>
      this.aiDraftRepository.create({
        batchId,
        entityType,
        payload: payload as Record<string, any>,
        similarity: similarities[index],
        status: AiDraftStatus.PENDING,
        prompt: dto.instruction ?? null,
        generateParams,
        // model ที่ตอบสำเร็จจริง อาจเป็นตัวสำรองใน chain ไม่ใช่ตัวแรก
        model: completion.model,
        createdBy: userId,
      }),
    );
    await this.aiDraftRepository.save(rows);

    this.logger.log(
      `AI draft batch ${batchId}: created ${rows.length} ${entityType} draft(s), rejected ${rejected.length}`,
    );

    return {
      batchId,
      created: rows.length,
      rejected: rejected.map((r) => ({ reason: r.reason })),
    };
  }

  // ──────────────────────────── regenerate ────────────────────────────

  /** สร้างข้อนั้นใหม่ โดยยังเป็นแถวเดิม (id เดิม) เพื่อไม่ให้ลำดับที่ admin ดูอยู่กระโดด */
  async regenerateOne(id: number, instruction?: string): Promise<AiDraft> {
    const draft = await this.findOneOrFail(id);
    if (draft.status !== AiDraftStatus.PENDING) {
      throw new BadRequestException(
        'สร้างใหม่ได้เฉพาะร่างที่ยังรอตรวจอยู่เท่านั้น',
      );
    }

    const skills = await this.loadSkillContext();
    const params = draft.generateParams ?? {};
    const samples = await this.loadSamples(draft.entityType, params.skillId);
    const existingExercises = await this.loadExistingExercises(
      draft.entityType,
    );
    const promptExercises = selectPromptExercises(
      existingExercises,
      params.skillId,
    );

    // รวมคำสั่งเดิมกับคำสั่งใหม่ เพื่อไม่ให้บริบทตอนสั่งครั้งแรกหายไป
    const combinedInstruction = [draft.prompt, instruction]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join('\n');

    const { system, user } = buildPrompt({
      entityType: draft.entityType,
      count: 1,
      instruction: combinedInstruction || undefined,
      skills,
      samples,
      existingExercises: promptExercises.items,
      existingExercisesScope: promptExercises.scope,
      skillId: params.skillId,
      skillLevel: params.skillLevel,
      exerciseType: params.exerciseType,
      avoid: draft.payload,
    });

    const completion = await this.llmClient.complete(system, user, {
      maxTokens: 2048,
    });

    const { valid, rejected, similarities } = this.validateByType(
      draft.entityType,
      extractJsonArray(completion.text),
      skills,
      {
        entityType: draft.entityType,
        count: 1,
        skillId: params.skillId,
        skillLevel: params.skillLevel,
      },
      existingExercises,
    );

    if (valid.length === 0) {
      throw new BadRequestException(
        `สร้างใหม่ไม่สำเร็จ — รายการที่ได้ไม่ผ่านการตรวจ (${rejected
          .map((r) => r.reason)
          .join('; ')})`,
      );
    }

    draft.payload = valid[0] as Record<string, any>;
    draft.similarity = similarities[0];
    draft.model = completion.model;
    draft.note = instruction?.slice(0, 255) ?? draft.note;
    draft.updatedAt = new Date();
    return this.aiDraftRepository.save(draft);
  }

  // ───────────────────────────── read/edit ─────────────────────────────

  async findAll(query: FindDraftsQueryDto): Promise<AiDraft[]> {
    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.entityType) where.entityType = query.entityType;
    if (query.batchId) where.batchId = query.batchId;

    return this.aiDraftRepository.find({
      where,
      order: { id: 'DESC' },
    });
  }

  async findOneOrFail(id: number): Promise<AiDraft> {
    const draft = await this.aiDraftRepository.findOne({ where: { id } });
    if (!draft) {
      throw new NotFoundException(`ไม่พบร่าง id ${id}`);
    }
    return draft;
  }

  /** admin แก้เอง — ตรวจซ้ำด้วยกติกาชุดเดียวกันก่อนเซฟ */
  async updatePayload(
    id: number,
    payload: Record<string, any>,
  ): Promise<AiDraft> {
    const draft = await this.findOneOrFail(id);
    if (draft.status !== AiDraftStatus.PENDING) {
      throw new BadRequestException('แก้ไขได้เฉพาะร่างที่ยังรอตรวจอยู่เท่านั้น');
    }

    const skills = await this.loadSkillContext();
    const params = draft.generateParams ?? {};
    // admin แก้เองก็ยังห้ามซ้ำตรงตัวกับโจทย์เดิม — similarity เดิมคงไว้ เพราะไม่มี LLM ประเมินใหม่
    const { valid, rejected } = this.validateByType(
      draft.entityType,
      [payload],
      skills,
      {
        entityType: draft.entityType,
        count: 1,
        skillId: params.skillId,
        skillLevel: params.skillLevel,
      },
      await this.loadExistingExercises(draft.entityType),
    );

    if (valid.length === 0) {
      throw new BadRequestException(
        rejected[0]?.reason ?? 'ข้อมูลที่แก้ไม่ผ่านการตรวจ',
      );
    }

    draft.payload = valid[0] as Record<string, any>;
    draft.updatedAt = new Date();
    return this.aiDraftRepository.save(draft);
  }

  // ────────────────────────── approve / reject ──────────────────────────

  /**
   * บันทึกลงตารางจริง โดย delegate ไปที่ service เดิมของแต่ละ entity
   * เพื่อให้ validation และการ seed ค่า BKT (pS/pG) อยู่ที่เดียวกับ flow ปกติ
   *
   * ครอบด้วย database transaction เพื่อให้การสร้าง entity จริงและการอัปเดต
   * สถานะ draft เป็น approved เกิดขึ้นพร้อมกัน หากขั้นตอนใดล้มเหลวจะ rollback ทั้งหมด
   */
  async approve(id: number, status: Status): Promise<AiDraft> {
    if (status !== Status.ACTIVE && status !== Status.INACTIVE) {
      throw new BadRequestException('status ต้องเป็น active หรือ inactive');
    }

    return this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(AiDraft, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!draft) {
        throw new NotFoundException(`ไม่พบร่าง id ${id}`);
      }
      if (draft.status !== AiDraftStatus.PENDING) {
        throw new BadRequestException('ร่างนี้ถูกตรวจไปแล้ว');
      }

      let approvedEntityId: number;
      switch (draft.entityType) {
        case AiDraftEntityType.EXERCISE: {
          const created = await this.exerciseSvc.createExercise(
            {
              ...(draft.payload as unknown as CreateExerciseDto),
              status,
            },
            manager,
          );
          approvedEntityId = created.id;
          break;
        }
        case AiDraftEntityType.SKILL: {
          const created = await this.skillSvc.createSkillWithPrerequisite(
            {
              ...(draft.payload as unknown as CreateSkillWithPrerequisiteDto),
              status,
            },
            manager,
          );
          approvedEntityId = created.skillId;
          break;
        }
        case AiDraftEntityType.GOAL: {
          const created = await this.goalSvc.createGoalWithSkillRequire(
            {
              ...(draft.payload as unknown as CreateGoalWithSkillRequireDto),
              status,
            },
            manager,
          );
          approvedEntityId = created.id;
          break;
        }
        default:
          throw new BadRequestException(
            `entityType ไม่รองรับ: ${String(draft.entityType)}`,
          );
      }

      draft.status = AiDraftStatus.APPROVED;
      draft.approvedEntityId = approvedEntityId;
      draft.updatedAt = new Date();
      return manager.save(AiDraft, draft);
    });
  }

  async reject(id: number, note?: string): Promise<AiDraft> {
    const draft = await this.findOneOrFail(id);
    if (draft.status !== AiDraftStatus.PENDING) {
      throw new BadRequestException('ร่างนี้ถูกตรวจไปแล้ว');
    }
    draft.status = AiDraftStatus.REJECTED;
    draft.note = note?.slice(0, 255) ?? draft.note;
    draft.updatedAt = new Date();
    return this.aiDraftRepository.save(draft);
  }

  // ────────────────────────────── helpers ──────────────────────────────

  private async loadSkillContext(): Promise<SkillContextItem[]> {
    const skills = await this.skillRepository.find({
      order: { skillId: 'ASC' },
    });
    return skills.map((s) => ({
      skillId: s.skillId,
      skillCode: s.skillCode,
      skillsName: s.skillsName,
      tier: s.tier ?? null,
    }));
  }

  /**
   * โจทย์ทุกข้อใน DB (ทุก skill ทุก status) ให้ LLM เทียบว่าซ้ำหรือคล้ายข้อไหน
   * select เฉพาะ id/description/code — ไม่ดึงทั้ง entity
   */
  private async loadExistingExercises(
    entityType: AiDraftEntityType,
  ): Promise<ExistingExerciseItem[]> {
    if (entityType !== AiDraftEntityType.EXERCISE) return [];
    const exercises = await this.exerciseRepository.find({
      select: { id: true, skillId: true, description: true, code: true },
      order: { id: 'ASC' },
    });
    return exercises.map((e) => ({
      id: e.id,
      skillId: e.skillId,
      description: e.description,
      code: e.code ?? null,
    }));
  }

  /** ตัวอย่างของเดิมให้ LLM เลียนสไตล์ — ตัดเฉพาะ field ที่จำเป็น ไม่ส่งทั้ง entity */
  private async loadSamples(
    entityType: AiDraftEntityType,
    skillId?: number,
  ): Promise<unknown[]> {
    if (entityType === AiDraftEntityType.EXERCISE) {
      const exercises = await this.exerciseRepository.find({
        where: skillId ? { skillId } : {},
        relations: { exerciseChoices: true },
        order: { id: 'DESC' },
        take: SAMPLE_LIMIT,
      });
      return exercises.map((e) => ({
        description: e.description,
        skillId: e.skillId,
        skillLevel: e.skillLevel,
        type: e.type,
        expectTime: e.expectTime,
        code: e.code ?? '',
        language: e.language ?? undefined,
        fillInBlank: e.fillInBlank ?? undefined,
        choices: e.exerciseChoices?.map((c) => ({
          script: c.script,
          isAnswer: c.isAnswer,
        })),
      }));
    }

    if (entityType === AiDraftEntityType.SKILL) {
      const skills = await this.skillRepository.find({
        order: { skillId: 'DESC' },
        take: SAMPLE_LIMIT,
      });
      return skills.map((s) => ({
        skillCode: s.skillCode,
        skillsName: s.skillsName,
        tier: s.tier,
      }));
    }

    const goals = await this.goalRepository.find({
      relations: { goalSkillRequire: true },
      order: { id: 'DESC' },
      take: SAMPLE_LIMIT,
    });
    return goals.map((g) => ({
      goal: g.goal,
      goalDescription: g.goalDescription,
      skillRequires: g.goalSkillRequire?.map((r) => ({
        skillId: r.skillId,
        levelRequire: r.levelRequire,
      })),
    }));
  }

  private validateByType(
    entityType: AiDraftEntityType,
    items: unknown[],
    skills: SkillContextItem[],
    dto: Pick<GenerateDraftDto, 'skillId' | 'skillLevel'> & {
      entityType: AiDraftEntityType;
      count: number;
    },
    existingExercises: ExistingExerciseItem[] = [],
  ): {
    valid: unknown[];
    rejected: RejectedDraft[];
    /** เรียงตรงกับ valid — skill/goal เป็น null ทั้งหมด */
    similarities: (ExerciseSimilarity | null)[];
  } {
    const existingSkillIds = new Set(skills.map((s) => s.skillId));
    const withoutSimilarity = (result: {
      valid: unknown[];
      rejected: RejectedDraft[];
    }) => ({ ...result, similarities: result.valid.map(() => null) });

    switch (entityType) {
      case AiDraftEntityType.EXERCISE:
        return validateExerciseDrafts(items, {
          existingSkillIds,
          fallbackSkillId: dto.skillId,
          fallbackSkillLevel: dto.skillLevel,
          existingExerciseIds: new Set(existingExercises.map((e) => e.id)),
          existingExerciseKeys: new Map(
            existingExercises.map((e) => [
              exerciseDuplicateKey(e.description, e.code),
              e.id,
            ]),
          ),
        });
      case AiDraftEntityType.SKILL:
        return withoutSimilarity(
          validateSkillDrafts(items, {
            existingSkillIds,
            existingSkillCodes: new Set(
              skills.map((s) => s.skillCode.toUpperCase()),
            ),
          }),
        );
      case AiDraftEntityType.GOAL:
        return withoutSimilarity(
          validateGoalDrafts(items, { existingSkillIds }),
        );
    }
  }
}
