import { BadRequestException } from '@nestjs/common';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import { CreateExerciseDto } from 'src/dto/exerciseAndSession/exercise.dto';
import { CreateSkillWithPrerequisiteDto } from 'src/dto/skill.dto';
import { CreateGoalWithSkillRequireDto } from 'src/dto/goal.dto';

/**
 * กติกาตรวจร่างจาก LLM — ใช้ชุดเดียวกับที่ exercise/skill/goal service บังคับจริง
 * เพื่อไม่ให้ร่างที่บันทึกไว้ ไป error ตอน admin กด approve
 *
 * หมายเหตุ: global ValidationPipe ใน main.ts ถูกปิดอยู่ class-validator จึงไม่ทำงาน
 * การตรวจทั้งหมดจึงต้องทำเองที่นี่
 */

/** ข้อจำกัดความยาวคอลัมน์จริงใน DB */
export const MAX_CHOICE_SCRIPT_LENGTH = 80; // exerciseChoice.script varchar(80)
export const MAX_SKILL_NAME_LENGTH = 30; // skill.skills_name varchar(30)
export const MAX_SKILL_CODE_LENGTH = 50;
export const MAX_GOAL_DESCRIPTION_LENGTH = 255; // goal.goal_description varchar(255)

/** SLIP_BY_LEVEL / GUESS_LEVEL_MULTIPLIER ใน libs/bkt/questionSelection.ts รองรับแค่ 1-5 */
export const MIN_SKILL_LEVEL = 1;
export const MAX_SKILL_LEVEL = 5;

export interface RejectedDraft {
  raw: unknown;
  reason: string;
}

export interface ValidationResult<T> {
  valid: T[];
  rejected: RejectedDraft[];
}

/**
 * ดึง JSON array ออกจากข้อความที่ LLM ตอบ — เผื่อกรณีห่อด้วย code fence
 * หรือมีคำอธิบายนำหน้า/ต่อท้าย ซึ่งเป็นพฤติกรรมปกติของ model หลายตัว
 */
export function extractJsonArray(text: string): unknown[] {
  if (!text || text.trim() === '') {
    throw new BadRequestException('LLM ตอบกลับมาเป็นข้อความว่าง');
  }

  let cleaned = text.trim();

  // ตัด code fence ออกก่อน (model ส่วนใหญ่ชอบห่อ JSON ไว้ในนั้น)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // หาบล็อก [ ... ] ตัวแรกถึงตัวปิดตัวสุดท้าย
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new BadRequestException(
      'ไม่พบ JSON array ในคำตอบของ LLM — ลองสั่งใหม่อีกครั้ง',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new BadRequestException(
      'คำตอบของ LLM ไม่ใช่ JSON ที่ถูกต้อง — ลองสั่งใหม่อีกครั้ง',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new BadRequestException('คำตอบของ LLM ไม่ใช่ JSON array');
  }
  return parsed;
}

function asRecord(item: unknown): Record<string, any> | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }
  return item as Record<string, any>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// ────────────────────────────── EXERCISE ──────────────────────────────

export interface ExerciseValidationContext {
  /** skillId ที่มีอยู่จริงในระบบ */
  existingSkillIds: Set<number>;
  /** ถ้า LLM ไม่ใส่ skillId มา ให้ใช้ค่าที่ admin เลือกไว้ในฟอร์ม */
  fallbackSkillId?: number;
  fallbackSkillLevel?: number;
}

export function validateExerciseDrafts(
  items: unknown[],
  ctx: ExerciseValidationContext,
): ValidationResult<CreateExerciseDto> {
  const valid: CreateExerciseDto[] = [];
  const rejected: RejectedDraft[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      rejected.push({ raw: item, reason: 'ไม่ใช่ object' });
      continue;
    }

    const description = nonEmptyString(record.description);
    if (!description) {
      rejected.push({ raw: item, reason: 'ไม่มี description' });
      continue;
    }

    const skillId = Number(record.skillId ?? ctx.fallbackSkillId);
    if (!Number.isInteger(skillId) || !ctx.existingSkillIds.has(skillId)) {
      rejected.push({
        raw: item,
        reason: `skillId ${String(record.skillId ?? ctx.fallbackSkillId)} ไม่มีอยู่ในระบบ`,
      });
      continue;
    }

    const skillLevel = Number(record.skillLevel ?? ctx.fallbackSkillLevel);
    if (
      !Number.isInteger(skillLevel) ||
      skillLevel < MIN_SKILL_LEVEL ||
      skillLevel > MAX_SKILL_LEVEL
    ) {
      rejected.push({
        raw: item,
        reason: `skillLevel ต้องเป็นจำนวนเต็ม ${MIN_SKILL_LEVEL}-${MAX_SKILL_LEVEL} (ได้ ${String(record.skillLevel)})`,
      });
      continue;
    }

    const type = record.type;
    if (type !== ExerciseType.CHOICE && type !== ExerciseType.FILL_IN_BLANK) {
      rejected.push({
        raw: item,
        reason: `type ต้องเป็น CHOICE หรือ FILL_IN_BLANK (ได้ ${String(type)})`,
      });
      continue;
    }

    const expectTimeRaw = Number(record.expectTime);
    const expectTime =
      Number.isFinite(expectTimeRaw) && expectTimeRaw > 0
        ? Math.round(expectTimeRaw)
        : 60;

    const draft: CreateExerciseDto = {
      description,
      skillId,
      skillLevel,
      type,
      expectTime,
    };

    if (type === ExerciseType.CHOICE) {
      const rawChoices = Array.isArray(record.choices) ? record.choices : [];
      if (rawChoices.length < 2 || rawChoices.length > 4) {
        rejected.push({
          raw: item,
          reason: `CHOICE ต้องมีตัวเลือก 2-4 ข้อ (ได้ ${rawChoices.length})`,
        });
        continue;
      }

      const choices: { script: string; isAnswer: boolean }[] = [];
      let choiceError: string | null = null;
      for (const rawChoice of rawChoices) {
        const choiceRecord = asRecord(rawChoice);
        const script = choiceRecord ? nonEmptyString(choiceRecord.script) : null;
        if (!script) {
          choiceError = 'มีตัวเลือกที่ script ว่าง';
          break;
        }
        if (script.length > MAX_CHOICE_SCRIPT_LENGTH) {
          choiceError = `ตัวเลือกยาวเกิน ${MAX_CHOICE_SCRIPT_LENGTH} ตัวอักษร`;
          break;
        }
        choices.push({ script, isAnswer: choiceRecord?.isAnswer === true });
      }
      if (choiceError) {
        rejected.push({ raw: item, reason: choiceError });
        continue;
      }

      const answerCount = choices.filter((c) => c.isAnswer).length;
      if (answerCount !== 1) {
        rejected.push({
          raw: item,
          reason: `ต้องมีคำตอบที่ถูกเพียงข้อเดียว (มี ${answerCount} ข้อ)`,
        });
        continue;
      }

      draft.choices = choices;
    } else {
      const fillInBlank = nonEmptyString(record.fillInBlank);
      if (!fillInBlank) {
        rejected.push({
          raw: item,
          reason: 'FILL_IN_BLANK ต้องมี fillInBlank ที่ไม่ว่าง',
        });
        continue;
      }
      draft.fillInBlank = fillInBlank;
      draft.isCasesensitive = record.isCasesensitive === 'YES' ? 'YES' : 'NO';
    }

    valid.push(draft);
  }

  return { valid, rejected };
}

// ─────────────────────────────── SKILL ───────────────────────────────

export interface SkillValidationContext {
  /** skillCode ที่มีอยู่แล้วในระบบ (เก็บเป็นตัวพิมพ์ใหญ่) */
  existingSkillCodes: Set<string>;
  existingSkillIds: Set<number>;
}

export function validateSkillDrafts(
  items: unknown[],
  ctx: SkillValidationContext,
): ValidationResult<CreateSkillWithPrerequisiteDto> {
  const valid: CreateSkillWithPrerequisiteDto[] = [];
  const rejected: RejectedDraft[] = [];
  // กันชื่อซ้ำกันเองภายในชุดเดียวกัน ไม่ใช่แค่ซ้ำกับของเดิมใน DB
  const seenCodes = new Set<string>();

  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      rejected.push({ raw: item, reason: 'ไม่ใช่ object' });
      continue;
    }

    const skillCode = nonEmptyString(record.skillCode);
    if (!skillCode) {
      rejected.push({ raw: item, reason: 'ไม่มี skillCode' });
      continue;
    }
    if (skillCode.length > MAX_SKILL_CODE_LENGTH) {
      rejected.push({
        raw: item,
        reason: `skillCode ยาวเกิน ${MAX_SKILL_CODE_LENGTH} ตัวอักษร`,
      });
      continue;
    }
    const codeKey = skillCode.toUpperCase();
    if (ctx.existingSkillCodes.has(codeKey)) {
      rejected.push({ raw: item, reason: `skillCode ${skillCode} มีอยู่แล้ว` });
      continue;
    }
    if (seenCodes.has(codeKey)) {
      rejected.push({
        raw: item,
        reason: `skillCode ${skillCode} ซ้ำกับข้ออื่นในชุดเดียวกัน`,
      });
      continue;
    }

    const skillsName = nonEmptyString(record.skillsName);
    if (!skillsName) {
      rejected.push({ raw: item, reason: 'ไม่มี skillsName' });
      continue;
    }
    if (skillsName.length > MAX_SKILL_NAME_LENGTH) {
      rejected.push({
        raw: item,
        reason: `skillsName ยาวเกิน ${MAX_SKILL_NAME_LENGTH} ตัวอักษร`,
      });
      continue;
    }

    const tierRaw = nonEmptyString(record.tier);
    const tier = tierRaw ? tierRaw.toUpperCase() : undefined;
    if (tier && !/^T[1-5]$/.test(tier)) {
      rejected.push({
        raw: item,
        reason: `tier ต้องเป็น T1-T5 (ได้ ${tier})`,
      });
      continue;
    }

    const rawPrereqs = Array.isArray(record.prerequisites)
      ? record.prerequisites
      : [];
    const prerequisites: { prerequisiteSkillId: number }[] = [];
    let prereqError: string | null = null;
    for (const rawPrereq of rawPrereqs) {
      const prereqRecord = asRecord(rawPrereq);
      const prerequisiteSkillId = Number(
        prereqRecord?.prerequisiteSkillId ?? rawPrereq,
      );
      if (
        !Number.isInteger(prerequisiteSkillId) ||
        !ctx.existingSkillIds.has(prerequisiteSkillId)
      ) {
        prereqError = `prerequisite skillId ${String(prerequisiteSkillId)} ไม่มีอยู่ในระบบ`;
        break;
      }
      if (
        !prerequisites.some((p) => p.prerequisiteSkillId === prerequisiteSkillId)
      ) {
        prerequisites.push({ prerequisiteSkillId });
      }
    }
    if (prereqError) {
      rejected.push({ raw: item, reason: prereqError });
      continue;
    }

    seenCodes.add(codeKey);
    valid.push({ skillCode, skillsName, tier, prerequisites });
  }

  return { valid, rejected };
}

// ─────────────────────────────── GOAL ───────────────────────────────

export interface GoalValidationContext {
  existingSkillIds: Set<number>;
}

export function validateGoalDrafts(
  items: unknown[],
  ctx: GoalValidationContext,
): ValidationResult<CreateGoalWithSkillRequireDto> {
  const valid: CreateGoalWithSkillRequireDto[] = [];
  const rejected: RejectedDraft[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      rejected.push({ raw: item, reason: 'ไม่ใช่ object' });
      continue;
    }

    const goal = nonEmptyString(record.goal);
    if (!goal) {
      rejected.push({ raw: item, reason: 'ไม่มีชื่อ goal' });
      continue;
    }

    const goalDescription = nonEmptyString(record.goalDescription) ?? undefined;
    if (
      goalDescription &&
      goalDescription.length > MAX_GOAL_DESCRIPTION_LENGTH
    ) {
      rejected.push({
        raw: item,
        reason: `goalDescription ยาวเกิน ${MAX_GOAL_DESCRIPTION_LENGTH} ตัวอักษร`,
      });
      continue;
    }

    const rawRequires = Array.isArray(record.skillRequires)
      ? record.skillRequires
      : [];
    if (rawRequires.length === 0) {
      rejected.push({
        raw: item,
        reason: 'goal ต้องมี skillRequires อย่างน้อย 1 ข้อ',
      });
      continue;
    }

    const skillRequires: { skillId: number; levelRequire?: number }[] = [];
    let requireError: string | null = null;
    for (const rawRequire of rawRequires) {
      const requireRecord = asRecord(rawRequire);
      const skillId = Number(requireRecord?.skillId ?? rawRequire);
      if (!Number.isInteger(skillId) || !ctx.existingSkillIds.has(skillId)) {
        requireError = `skillId ${String(skillId)} ไม่มีอยู่ในระบบ`;
        break;
      }
      if (skillRequires.some((s) => s.skillId === skillId)) {
        requireError = `skillId ${skillId} ซ้ำใน skillRequires`;
        break;
      }
      const levelRaw = Number(requireRecord?.levelRequire);
      const levelRequire =
        Number.isInteger(levelRaw) && levelRaw >= 1 && levelRaw <= 6
          ? levelRaw
          : undefined;
      skillRequires.push({ skillId, levelRequire });
    }
    if (requireError) {
      rejected.push({ raw: item, reason: requireError });
      continue;
    }

    valid.push({ goal, goalDescription, skillRequires });
  }

  return { valid, rejected };
}
