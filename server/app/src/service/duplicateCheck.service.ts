import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AiDraft } from 'src/entity/aiDraft.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { LlmClient } from 'src/libs/llm/llm.client';
import { findCandidates, PoolItem } from 'src/libs/llm/similarity';
import {
  buildCheckPrompt,
  CheckItem,
  DuplicateCheck,
  parseCheckResponse,
} from 'src/libs/llm/check.prompt';

export interface DraftToCheck {
  skillId: number;
  description: string;
  code?: string | null;
}

/**
 * ตรวจโจทย์ซ้ำของร่าง exercise ที่ generator สร้าง
 * โหลดตัวเทียบ → คัด top-K ด้วยโค้ด → ถาม checker LLM 1 call
 *
 * ไม่ throw — ล้มเมื่อไหร่ก็คืน checked=false ให้การ generate ไปต่อได้
 */
@Injectable()
export class duplicateCheckService {
  private readonly logger = new Logger(duplicateCheckService.name);

  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(AiDraft)
    private readonly aiDraftRepository: Repository<AiDraft>,
    private readonly llmClient: LlmClient,
  ) {}

  /**
   * โจทย์จริง (ทุก status) + ร่าง exercise ที่ยังรอตรวจ ของ skill ที่ระบุ
   * excludeDraftId = ร่างที่กำลัง regenerate/แก้ ไม่ให้เทียบกับตัวเอง
   */
  async loadPool(
    skillIds: number[],
    excludeDraftId?: number,
  ): Promise<PoolItem[]> {
    if (skillIds.length === 0) return [];
    const exercises = await this.exerciseRepository.find({
      where: { skillId: In(skillIds) },
      select: { id: true, skillId: true, description: true, code: true },
    });
    // ร่าง pending มีไม่มาก กรอง skillId ใน JS แทนการ query ใน jsonb
    const drafts = await this.aiDraftRepository.find({
      where: {
        entityType: AiDraftEntityType.EXERCISE,
        status: AiDraftStatus.PENDING,
      },
      select: { id: true, payload: true },
    });
    const wanted = new Set(skillIds);

    return [
      ...exercises.map((e) => ({
        kind: 'exercise' as const,
        id: e.id,
        skillId: e.skillId,
        description: e.description,
        code: e.code ?? null,
      })),
      ...drafts
        .filter(
          (d) =>
            d.id !== excludeDraftId && wanted.has(Number(d.payload?.skillId)),
        )
        .map((d) => ({
          kind: 'draft' as const,
          id: d.id,
          skillId: Number(d.payload.skillId),
          description: String(d.payload.description ?? ''),
          code: (d.payload.code as string | undefined) ?? null,
        })),
    ];
  }

  /** ผลเรียงตรงกับ drafts ทีละตัว */
  async check(
    drafts: DraftToCheck[],
    pool: PoolItem[],
  ): Promise<DuplicateCheck[]> {
    const items: CheckItem[] = drafts.map((d, index) => {
      const draft = { description: d.description, code: d.code ?? null };
      return {
        index,
        draft,
        candidates: findCandidates(
          draft,
          pool.filter((p) => p.skillId === Number(d.skillId)),
        ),
      };
    });

    const results: DuplicateCheck[] = drafts.map(() => ({
      checked: true,
      match: null,
    }));
    const toAsk = items.filter((i) => i.candidates.length > 0);
    // ไม่มีตัวเทียบที่ใกล้พอเลย = ไม่ซ้ำแน่ ไม่ต้องเสีย call
    if (toAsk.length === 0) return results;

    try {
      const { system, user } = buildCheckPrompt(toAsk);
      const completion = await this.llmClient.complete(system, user, {
        chain: 'check',
        temperature: 0,
        maxTokens: 256 + toAsk.length * 120,
      });
      const parsed = parseCheckResponse(completion.text, toAsk);
      for (const item of toAsk) {
        results[item.index] = parsed.get(item.index) ?? {
          checked: false,
          match: null,
        };
      }
    } catch (error) {
      this.logger.warn(
        `duplicate checker ล้มเหลว — ร่าง ${toAsk.length} ข้อถูกบันทึกแบบยังไม่ได้ตรวจซ้ำ: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      for (const item of toAsk) {
        results[item.index] = { checked: false, match: null };
      }
    }
    return results;
  }
}
