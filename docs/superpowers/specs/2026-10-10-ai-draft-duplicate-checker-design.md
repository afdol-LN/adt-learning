# AI draft — แยก Generator กับ Duplicate Checker

วันที่: 2026-10-10 · สถานะ: backend implement แล้ว (ข้อ 1–8) · frontend (ข้อ 9–12) ยังไม่ทำ

## ปัญหา

AI ตัวเดียวทำสองงานใน prompt เดียว: สร้างโจทย์ + ประเมิน `similarTo` กับโจทย์เดิมทั้ง skill

1. **prompt ยาวและแพงขึ้นเรื่อย ๆ** — ทุกครั้งที่ generate ส่งโจทย์เดิมของ skill นั้นไปทั้งหมดแบบไม่ตัด
2. **เช็คซ้ำไม่น่าเชื่อ** — ตัวที่สร้างเป็นคนให้คะแนนความคล้ายของงานตัวเอง
3. **ไม่เทียบกับร่าง pending** — generate skill เดิมสองรอบก่อนอนุมัติ ได้โจทย์ซ้ำกันเองได้
4. ค่า `similarity` ถูกเก็บใน DB แต่ **frontend ไม่เคยแสดง**

## สิ่งที่ตัดสินใจแล้ว

| เรื่อง | ตัดสินใจ |
|---|---|
| เป้าหมาย | ลดขนาด prompt + ให้การเช็คซ้ำน่าเชื่อขึ้น |
| เจอซ้ำแล้วทำอะไร | เก็บเป็น pending ตามปกติ แต่ **ติดป้ายเตือน** ให้ admin ตัดสินเอง |
| ซ้ำตรงตัวเป๊ะ | ยังตัดทิ้งด้วยโค้ดเหมือนเดิม |
| เทียบกับอะไร | `exercise` ทั้งหมด + `aiDraft` ที่ `pending` (exercise) ของ skill เดียวกัน |
| แนวทาง | โค้ดคัดตัวเทียบ top-5 → checker LLM 1 call |
| ขอบเขต | เฉพาะ exercise — skill/goal ไม่เปลี่ยน |

## Flow

```
POST /ai-draft/generate (exercise)
 ├─ 1. Generator LLM   prompt: skill, level, จำนวน, sample, instruction  (ไม่มีโจทย์เดิม)
 ├─ 2. validator       กฎเดิม + ตัดซ้ำตรงตัว (exercise + pending)
 ├─ 3. findCandidates  โค้ด: ร่างละ ≤ 5 ข้อที่ใกล้ที่สุด (คะแนน ≥ 0.15)
 ├─ 4. Checker LLM     1 call: ทุกร่าง + ตัวเทียบของมัน → ref, percent, reason
 └─ 5. save aiDraft    similarity = { checked, match }
```

regenerate ใช้ flow เดียวกัน โดยไม่นับร่างตัวเองเป็นตัวเทียบ · `PUT /ai-draft/:id` ไม่ตรวจใหม่ (ป้ายเดิมค้าง)

---

## ไฟล์ใหม่

### 1. `server/app/src/libs/llm/similarity.ts` — คัดตัวเทียบด้วยโค้ด (pure)

**หน้าที่:** ให้คะแนนความคล้าย 0–1 ระหว่างโจทย์สองข้อ และเลือก top-K ที่จะส่งให้ checker
ไม่เรียก AI ไม่แตะ DB — ทำให้ prompt ของ checker มีขนาดคงที่ ไม่ว่าคลังจะโตแค่ไหน

```ts
/** โจทย์ที่ใช้เทียบ — มาจากตาราง exercise หรือร่าง pending ใน aiDraft */
export interface PoolItem {
  kind: 'exercise' | 'draft';
  id: number;
  skillId: number;
  description: string;
  code: string | null;
}

export interface Candidate extends PoolItem {
  score: number;
}

export const CANDIDATE_LIMIT = 5;
/** ต่ำกว่านี้ถือว่าไม่เกี่ยวกันเลย ไม่ต้องส่งให้ checker เสีย token */
export const MIN_CANDIDATE_SCORE = 0.15;

/**
 * คำสงวน + builtin ที่พบบ่อย — คงไว้ตามตัว ไม่แทนเป็น ID
 * ไม่งั้น `for` กับ `while` หรือ `print` กับ `len` จะกลายเป็นตัวเดียวกัน
 */
const PY_KEEP = new Set([
  'False', 'None', 'True', 'and', 'as', 'break', 'class', 'continue', 'def',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'if', 'import', 'in',
  'is', 'lambda', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield', 'print', 'range', 'len', 'input', 'int', 'str', 'float',
  'bool', 'list', 'dict', 'set', 'tuple', 'sum', 'min', 'max', 'abs',
  'sorted', 'reversed', 'enumerate', 'zip', 'append', 'pop', 'insert',
  'remove', 'split', 'join', 'strip', 'upper', 'lower', 'keys', 'values',
  'items', 'get',
]);

/**
 * แปลงโค้ดเป็น token ที่ไม่สนชื่อตัวแปร ตัวเลข และข้อความ
 * `total = x + 1` กับ `s = a + 5` → ID = ID + NUM ทั้งคู่
 */
export function codeTokens(code: string | null | undefined): string[] {
  if (!code) return [];
  const tokens =
    code
      .replace(/#.*$/gm, '')
      .match(/"[^"\n]*"|'[^'\n]*'|[A-Za-z_]\w*|\d+(?:\.\d+)?|\S/g) ?? [];
  return tokens.map((t) => {
    if (t[0] === '"' || t[0] === "'") return 'STR';
    if (/^\d/.test(t)) return 'NUM';
    if (/^[A-Za-z_]/.test(t) && !PY_KEEP.has(t)) return 'ID';
    return t;
  });
}

function nGrams<T>(items: T[], n: number): Set<string> {
  const out = new Set<string>();
  if (items.length < n) {
    if (items.length > 0) out.add(items.join('\u0001'));
    return out;
  }
  for (let i = 0; i <= items.length - n; i++) {
    out.add(items.slice(i, i + n).join('\u0001'));
  }
  return out;
}

/** ภาษาไทยไม่เว้นวรรคระหว่างคำ จึงเทียบเป็นชิ้นตัวอักษร 3 ตัว แทนการตัดคำ */
export function textShingles(text: string): Set<string> {
  return nGrams([...text.toLowerCase().replace(/\s+/g, '')], 3);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

/** โค้ดมีน้ำหนักมากกว่า เพราะโจทย์ซ้ำจริงส่วนใหญ่คือโค้ดเดิมที่เปลี่ยนแค่ถ้อยคำถาม */
export function similarityScore(
  a: Pick<PoolItem, 'description' | 'code'>,
  b: Pick<PoolItem, 'description' | 'code'>,
): number {
  const desc = jaccard(textShingles(a.description), textShingles(b.description));
  const aCode = codeTokens(a.code);
  const bCode = codeTokens(b.code);
  if (aCode.length === 0 && bCode.length === 0) return desc;
  const code = jaccard(nGrams(aCode, 3), nGrams(bCode, 3));
  return 0.4 * desc + 0.6 * code;
}

export function findCandidates(
  draft: Pick<PoolItem, 'description' | 'code'>,
  pool: PoolItem[],
  limit = CANDIDATE_LIMIT,
): Candidate[] {
  return pool
    .map((item) => ({ ...item, score: similarityScore(draft, item) }))
    .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### 2. `server/app/src/libs/llm/check.prompt.ts` — prompt + parser ของ checker (pure)

**หน้าที่:** สร้าง prompt ที่ถามคำถามเดียว "ร่างนี้ซ้ำกับตัวเทียบข้อไหนไหม" และแปลงคำตอบเป็นผลที่เชื่อถือได้
ตัวเทียบอ้างด้วย ref สั้น ๆ (`E42` = exercise 42, `D17` = ร่าง #17) และ **ไม่เชื่อ ref ที่ไม่ได้ส่งไป**

```ts
import { extractJsonArray } from './draft.validator';
import { BuiltPrompt } from './prompt.builder';
import { Candidate } from './similarity';

/** percent ตั้งแต่ค่านี้ขึ้นไป UI ติดป้าย "อาจซ้ำ" */
export const FLAG_SIMILARITY_PERCENT = 70;
const REASON_LIMIT = 200;
const PREVIEW_LIMIT = 120;

export interface DuplicateMatch {
  kind: 'exercise' | 'draft';
  id: number;
  percent: number;
  reason: string;
  /** description ของข้อที่ชน ให้ admin เทียบได้โดยไม่ต้องไปค้น */
  preview: string;
}

/** เก็บใน aiDraft.similarity — checked=false แปลว่า checker ล้มหรือไม่ได้ตอบข้อนี้ */
export interface DuplicateCheck {
  checked: boolean;
  match: DuplicateMatch | null;
}

export interface CheckItem {
  index: number;
  draft: { description: string; code: string | null };
  candidates: Candidate[];
}

export const refOf = (c: { kind: 'exercise' | 'draft'; id: number }) =>
  `${c.kind === 'exercise' ? 'E' : 'D'}${c.id}`;

const SYSTEM = [
  'คุณเป็นผู้ตรวจโจทย์ซ้ำของคลังข้อสอบวิชาการเขียนโปรแกรม Python',
  'แต่ละ item มี "draft" (โจทย์ใหม่) และ "candidates" (โจทย์เดิมที่อาจซ้ำ)',
  'ให้หาว่า draft ซ้ำกับ candidate ข้อไหนมากที่สุด',
  '',
  '"ซ้ำ" = ถามสิ่งเดียวกันด้วยโค้ดเดียวกันหรือแทบเหมือนกัน แม้เปลี่ยนถ้อยคำ ชื่อตัวแปร หรือตัวเลขเล็กน้อย',
  '"ไม่ซ้ำ" = แนวคิดเดียวกันแต่โค้ดหรือสิ่งที่ถามต่างกันจริง',
  '',
  'ตอบเป็น JSON array ล้วน ๆ หนึ่ง object ต่อหนึ่ง item:',
  '{ "index": number, "ref": string | null, "percent": number, "reason": string }',
  '- ref = ref ของ candidate ที่ซ้ำที่สุด หรือ null ถ้าไม่ซ้ำข้อไหน',
  '- percent = ความคล้าย 0-100 (จำนวนเต็ม)',
  '- reason = เหตุผลสั้น ๆ ภาษาไทย ไม่เกิน 1 ประโยค',
].join('\n');

export function buildCheckPrompt(items: CheckItem[]): BuiltPrompt {
  const payload = items.map((item) => ({
    index: item.index,
    draft: { description: item.draft.description, code: item.draft.code ?? '' },
    candidates: item.candidates.map((c) => ({
      ref: refOf(c),
      description: c.description,
      code: c.code ?? '',
    })),
  }));
  return { system: SYSTEM, user: JSON.stringify(payload, null, 2) };
}

/**
 * คืน Map index → ผล; index ที่ไม่อยู่ใน Map = checker ไม่ได้ตอบ → ผู้เรียกใส่ checked=false
 * throw เมื่อคำตอบไม่ใช่ JSON array เลย (ผู้เรียกจับแล้วถือว่าล้มทั้งชุด)
 */
export function parseCheckResponse(
  text: string,
  items: CheckItem[],
): Map<number, DuplicateCheck> {
  const byIndex = new Map(items.map((i) => [i.index, i]));
  const result = new Map<number, DuplicateCheck>();

  for (const raw of extractJsonArray(text)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const item = byIndex.get(Number(r.index));
    if (!item || result.has(item.index)) continue;

    const percent = Math.round(Number(r.percent));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) continue;

    if (r.ref === null || r.ref === undefined || r.ref === '') {
      result.set(item.index, { checked: true, match: null });
      continue;
    }
    // ref ที่ไม่ได้ส่งไปให้ = checker แต่งขึ้นเอง ไม่เชื่อ
    const hit = item.candidates.find((c) => refOf(c) === String(r.ref));
    if (!hit) continue;

    result.set(item.index, {
      checked: true,
      match: {
        kind: hit.kind,
        id: hit.id,
        percent,
        reason: String(r.reason ?? '').slice(0, REASON_LIMIT),
        preview: hit.description.slice(0, PREVIEW_LIMIT),
      },
    });
  }
  return result;
}
```

### 3. `server/app/src/service/duplicateCheck.service.ts` — ต่อทุกชิ้นเข้าด้วยกัน

**หน้าที่:** โหลด pool (exercise + ร่าง pending ของ skill เดียวกัน) → คัดตัวเทียบ → เรียก checker 1 call → คืนผลเรียงตรงกับร่าง
**ไม่ throw** — ล้มเมื่อไหร่ก็คืน `checked: false` ให้ generate ไปต่อได้

```ts
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
   * โจทย์จริง + ร่าง exercise ที่ยังรอตรวจ ของ skill ที่ระบุ
   * excludeDraftId = ร่างที่กำลัง regenerate ไม่ให้เทียบกับตัวเอง
   */
  async loadPool(skillIds: number[], excludeDraftId?: number): Promise<PoolItem[]> {
    if (skillIds.length === 0) return [];
    const exercises = await this.exerciseRepository.find({
      where: { skillId: In(skillIds) },
      select: { id: true, skillId: true, description: true, code: true },
    });
    // ร่าง pending มีไม่มาก กรอง skillId ใน JS แทนการ query jsonb
    const drafts = await this.aiDraftRepository.find({
      where: { entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING },
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
        .filter((d) => d.id !== excludeDraftId && wanted.has(Number(d.payload?.skillId)))
        .map((d) => ({
          kind: 'draft' as const,
          id: d.id,
          skillId: Number(d.payload.skillId),
          description: String(d.payload.description ?? ''),
          code: d.payload.code ?? null,
        })),
    ];
  }

  /** ผลเรียงตรงกับ drafts ทีละตัว */
  async check(drafts: DraftToCheck[], pool: PoolItem[]): Promise<DuplicateCheck[]> {
    const items: CheckItem[] = drafts.map((d, index) => ({
      index,
      draft: { description: d.description, code: d.code ?? null },
      candidates: findCandidates(d, pool.filter((p) => p.skillId === d.skillId)),
    }));

    const results: DuplicateCheck[] = drafts.map(() => ({ checked: true, match: null }));
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
        results[item.index] = parsed.get(item.index) ?? { checked: false, match: null };
      }
    } catch (error) {
      this.logger.warn(
        `duplicate checker ล้มเหลว — ร่าง ${toAsk.length} ข้อถูกบันทึกแบบยังไม่ได้ตรวจซ้ำ: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      for (const item of toAsk) results[item.index] = { checked: false, match: null };
    }
    return results;
  }
}
```

ต้องลงทะเบียนใน `app.module.ts` ที่ `providers` (ไม่งั้นพังเงียบแบบ `BktCornService`)

---

## ไฟล์ที่แก้

### 4. `libs/llm/llm.client.ts` — เพิ่ม chain แยกให้ checker

**ทำไม:** อยากให้ตั้ง model ถูก/เร็วให้ checker ได้ ถ้าไม่ตั้ง `LLM_CHECK_CHAIN` ใช้ chain เดิม

```ts
// field
private readonly candidates: LlmCandidate[];
private readonly checkCandidates: LlmCandidate[];

// constructor
this.candidates = this.loadCandidates('LLM_CHAIN', true);
const check = this.loadCandidates('LLM_CHECK_CHAIN', false);
this.checkCandidates = check.length > 0 ? check : this.candidates;

// complete()
options: { temperature?: number; maxTokens?: number; chain?: 'generate' | 'check' } = {},
...
const candidates = options.chain === 'check' ? this.checkCandidates : this.candidates;
// วน loop ด้วย candidates แทน this.candidates

// loadCandidates — รับชื่อตัวแปร; legacy LLM_* ใช้เฉพาะ chain หลัก
private loadCandidates(envName: string, allowLegacy: boolean): LlmCandidate[] {
  const chain = (this.configService.get<string>(envName) || '').trim();
  ...
  if (names.length === 0) {
    if (!allowLegacy) return [];
    const legacy = this.buildCandidate('LLM', 'LLM');
    return legacy ? [legacy] : [];
  }
  ...
}
```

### 5. `libs/llm/prompt.builder.ts` — generator ไม่รับโจทย์เดิมอีกต่อไป

**ลบ:** `ExistingExerciseItem`, `ExistingExercisesScope`, `selectPromptExercises`, `EXISTING_TEXT_LIMIT`, `clip`, `renderExistingExercises`,
field `existingExercises`/`existingExercisesScope` ใน `PromptInput`, field `similarTo` ใน schema, บล็อก "กติกาเรื่องโจทย์ซ้ำ", และส่วน "โจทย์ที่มีอยู่แล้วใน skill นี้" ใน user prompt
**คงไว้:** `avoid` (regenerate) และ 1 บรรทัด:

```ts
'- โจทย์ในชุดที่สร้างครั้งนี้ต้องไม่ซ้ำกันเอง',
```

### 6. `libs/llm/draft.validator.ts` — เหลือแค่ซ้ำตรงตัว แต่ครอบคลุมร่าง pending

**ลบ:** `DUPLICATE_SIMILARITY_PERCENT`, `ExerciseSimilarity`, `readSimilarity`, `existingExerciseIds`, `similarities` ใน result, การเช็ค `similarTo ≥ 90`

```ts
export interface ExerciseValidationContext {
  existingSkillIds: Set<number>;
  fallbackSkillId?: number;
  fallbackSkillLevel?: number;
  /** exerciseDuplicateKey -> ข้อเดิม (โจทย์จริงหรือร่าง pending) */
  existingExerciseKeys?: Map<string, { kind: 'exercise' | 'draft'; id: number }>;
}

// ใน validateExerciseDrafts
const exact = ctx.existingExerciseKeys?.get(key);
if (exact) {
  rejected.push({
    raw: item,
    reason:
      exact.kind === 'exercise'
        ? `โจทย์ซ้ำกับข้อเดิม id ${exact.id}`
        : `โจทย์ซ้ำกับร่าง #${exact.id} ที่รอตรวจอยู่`,
  });
  continue;
}
```

`validateExerciseDrafts` คืน `ValidationResult<CreateExerciseDto>` ธรรมดา (ไม่มี `similarities`)

### 7. `service/aiDraft.service.ts` — เรียก checker ระหว่าง validate กับ save

```ts
// generate()
const skills = await this.loadSkillContext();
const samples = await this.loadSamples(entityType, dto.skillId);

const { system, user } = buildPrompt({
  entityType, count, instruction: dto.instruction, skills, samples,
  skillId: dto.skillId, skillLevel: dto.skillLevel, exerciseType: dto.exerciseType,
});
const completion = await this.llmClient.complete(system, user, {
  maxTokens: Math.min(1024 + count * 400, 8192),
});

const parsed = extractJsonArray(completion.text);
const pool = await this.loadDuplicatePool(entityType, parsed, dto.skillId);
const { valid, rejected } = this.validateByType(entityType, parsed, skills, dto, pool);
if (valid.length === 0) { /* throw เหมือนเดิม */ }

const checks = await this.checkDuplicates(entityType, valid, pool);
const rows = valid.map((payload, index) =>
  this.aiDraftRepository.create({ ..., similarity: checks[index] }),
);

// regenerateOne() — เหมือนกัน แต่ loadDuplicatePool(..., draft.id) ไม่ให้เทียบตัวเอง
// updatePayload() — ใช้ pool เพื่อตัดซ้ำตรงตัว แต่ไม่เรียก checker (similarity เดิมคงไว้)

// findAll() — แปลงแถวเก่า { exerciseId, percent } เป็นรูปใหม่ตอนอ่าน
return drafts.map((d) => ({ ...d, similarity: normalizeSimilarity(d.similarity) }));

// helpers
private async loadDuplicatePool(entityType, items: unknown[], fallbackSkillId?: number, excludeDraftId?: number) {
  if (entityType !== AiDraftEntityType.EXERCISE) return [];
  const skillIds = new Set<number>();
  if (fallbackSkillId) skillIds.add(Number(fallbackSkillId));
  for (const i of items) {
    const id = Number((i as any)?.skillId);
    if (Number.isInteger(id)) skillIds.add(id);
  }
  return this.duplicateCheck.loadPool([...skillIds], excludeDraftId);
}

private async checkDuplicates(entityType, valid: unknown[], pool: PoolItem[]) {
  if (entityType !== AiDraftEntityType.EXERCISE) return valid.map(() => null);
  return this.duplicateCheck.check(valid as CreateExerciseDto[], pool);
}
```

`loadExistingExercises` ถูกลบ — `loadDuplicatePool` ทำหน้าที่แทนและแคบกว่า (เฉพาะ skill ที่เกี่ยว)

### 8. `entity/aiDraft.entity.ts` — แค่เปลี่ยน type (jsonb ไม่ต้อง migration)

```ts
/**
 * เฉพาะ exercise: ผลตรวจซ้ำจาก duplicate checker
 * null = ไม่ได้ตรวจ (skill/goal) · แถวเก่าเป็น { exerciseId, percent } แปลงตอนอ่านใน findAll
 */
@Column({ type: 'jsonb', nullable: true })
similarity: DuplicateCheck | null;
```

---

## Frontend (`G06_adaptive_learning/`)

### 9. `src/models/aiDraftModel.ts`

```ts
export interface DuplicateMatch {
  kind: "exercise" | "draft";
  id: number;
  percent: number;
  reason: string;
  preview: string;
}

export interface DuplicateCheck {
  checked: boolean;
  match: DuplicateMatch | null;
}

// ใน AiDraft
similarity: DuplicateCheck | null;

/** ต้องตรงกับ FLAG_SIMILARITY_PERCENT ฝั่ง backend */
export const FLAG_SIMILARITY_PERCENT = 70;
```

### 10. `src/component/adminHome/aiPanel/component/DraftCard.tsx`

```tsx
import { FaCheck, FaPen, FaRotate, FaTriangleExclamation, FaXmark } from "react-icons/fa6";
import { AiDraft, ..., FLAG_SIMILARITY_PERCENT } from "../../../../models/aiDraftModel";

function DuplicateNotice({ similarity }: { similarity: AiDraft["similarity"] }) {
  const { t } = usePreferences();
  if (!similarity) return null;

  if (!similarity.checked) {
    return <div className="ad-ai-dup ad-ai-dup--unchecked">{t("admin.ai.dup.unchecked")}</div>;
  }
  const match = similarity.match;
  if (!match || match.percent < FLAG_SIMILARITY_PERCENT) return null;

  return (
    <div className="ad-ai-dup ad-ai-dup--warn" role="note">
      <div className="ad-ai-dup-title">
        <FaTriangleExclamation aria-hidden />
        {t(match.kind === "exercise" ? "admin.ai.dup.exercise" : "admin.ai.dup.draft", {
          id: match.id,
          percent: match.percent,
        })}
      </div>
      {match.preview && <p className="ad-ai-dup-preview">“{match.preview}”</p>}
      {match.reason && <p className="ad-ai-dup-reason">{match.reason}</p>}
    </div>
  );
}

// ใน DraftCard ระหว่าง ad-ai-draft-body กับข้อความ approved/rejected
{draft.entityType === "exercise" && isPending && (
  <DuplicateNotice similarity={draft.similarity} />
)}
```

### 11. i18n — `admin.th.ts` / `admin.en.ts`

```ts
// th
"admin.ai.dup.exercise": "อาจซ้ำกับโจทย์ id {id} ({percent}%)",
"admin.ai.dup.draft": "อาจซ้ำกับร่าง #{id} ที่รอตรวจ ({percent}%)",
"admin.ai.dup.unchecked": "ยังไม่ได้ตรวจซ้ำ",
// en
"admin.ai.dup.exercise": "Possible duplicate of exercise #{id} ({percent}%)",
"admin.ai.dup.draft": "Possible duplicate of pending draft #{id} ({percent}%)",
"admin.ai.dup.unchecked": "Duplicate check not run",
```

### 12. `src/component/decorate/Adminhome.css`

```css
/* ตัวแปรสีคู่ light/dark — ห้ามใช้ hex ตรง ๆ ในคลาส */
:root {
  --ad-dup-warn-bg: #fff7e6;
  --ad-dup-warn-border: #f0b429;
  --ad-dup-warn-text: #8a5a00;
  --ad-dup-muted-bg: #f1f5f9;
  --ad-dup-muted-text: #64748b;
}
:root[data-theme="dark"] .ad-app {
  --ad-dup-warn-bg: rgba(240, 180, 41, 0.12);
  --ad-dup-warn-border: #f0b429;
  --ad-dup-warn-text: #ffd27a;
  --ad-dup-muted-bg: rgba(148, 163, 184, 0.12);
  --ad-dup-muted-text: #cbd5e1;
}

.ad-ai-dup {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
}
.ad-ai-dup--warn {
  background: var(--ad-dup-warn-bg);
  border: 1px solid var(--ad-dup-warn-border);
  color: var(--ad-dup-warn-text);
}
.ad-ai-dup--unchecked {
  background: var(--ad-dup-muted-bg);
  color: var(--ad-dup-muted-text);
}
.ad-ai-dup-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ad-ai-dup-preview, .ad-ai-dup-reason { margin: 4px 0 0; }
```

---

## Config

`.env.dev` (ไม่บังคับ):

```
# ไม่ตั้ง = checker ใช้ LLM_CHAIN ตัวเดียวกับ generator
LLM_CHECK_CHAIN=DOTBLUE_GEMMA
```

## Error handling

| สถานการณ์ | ผล |
|---|---|
| checker ล้มทั้ง chain / ตอบไม่ใช่ JSON | ทุกข้อ `checked: false` — generate ยังสำเร็จ |
| checker ตอบไม่ครบ | ข้อที่ขาด `checked: false` |
| checker อ้าง ref ที่ไม่ได้ส่งไป / percent นอก 0–100 | ข้อนั้น `checked: false` |
| ไม่มีตัวเทียบที่คะแนน ≥ 0.15 | `checked: true, match: null` ไม่เรียก checker |

## Testing

- `similarity.spec.ts` — เปลี่ยนชื่อตัวแปร = คะแนนโค้ด 1; `for` ≠ `while`; ไทยต่างถ้อยคำ > คนละเรื่อง; top-K เรียงและจำกัดจำนวน
- `check.prompt.spec.ts` — parse ปกติ / fenced / มีข้อความนำ; ref แต่งเอง → ทิ้ง; percent นอกช่วง → ทิ้ง; reason ถูกตัด
- `duplicateCheck.service.spec.ts` — pool = exercise + pending skill เดียวกัน, ไม่รวม excludeDraftId; LLM throw → `checked:false`; ไม่มีตัวเทียบ → ไม่เรียก `complete`; ส่ง `chain: 'check'`
- แก้ `prompt.builder.spec.ts`, `draft.validator.spec.ts`, `llm.client.spec.ts`, `aiDraft.service.spec.ts` ตาม design
- frontend: `npx tsc -b` กรองไฟล์ที่แตะ + เปิด admin AI tab ดูป้ายทั้ง 3 แบบ light/dark

## Docs ที่ต้องอัปเดตพร้อมกัน

`CLAUDE.md` + `GEMINI.md` (root) และ `adt-learning/CLAUDE.md` + `GEMINI.md` — หัวข้อ AI assistant: generator/checker, `LLM_CHECK_CHAIN`, ป้ายเตือน, validator เหลือแค่ซ้ำตรงตัว
