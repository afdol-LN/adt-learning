import { extractJsonArray } from './draft.validator';
import { BuiltPrompt } from './prompt.builder';
import { Candidate } from './similarity';

/**
 * prompt + parser ของ duplicate checker — LLM ตัวที่สองที่ถามคำถามเดียว:
 * "ร่างนี้ซ้ำกับตัวเทียบข้อไหนไหม"
 *
 * ตัวเทียบอ้างด้วย ref สั้น ๆ (E42 = exercise 42, D17 = ร่าง #17)
 * และไม่เชื่อ ref ที่ไม่ได้ส่งไปให้ — กัน checker แต่ง id ขึ้นเอง
 */

/** percent ตั้งแต่ค่านี้ขึ้นไป UI ติดป้าย "อาจซ้ำ" — ไม่ได้ใช้ตัดทิ้ง admin ตัดสินเอง */
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

export const refOf = (c: { kind: 'exercise' | 'draft'; id: number }): string =>
  `${c.kind === 'exercise' ? 'E' : 'D'}${c.id}`;

const SYSTEM = [
  'คุณเป็นผู้ตรวจโจทย์ซ้ำของคลังข้อสอบวิชาการเขียนโปรแกรม Python',
  'แต่ละ item มี "draft" (โจทย์ใหม่) และ "candidates" (โจทย์เดิมที่อาจซ้ำ)',
  'ให้หาว่า draft ซ้ำกับ candidate ข้อไหนมากที่สุด',
  '',
  '"ซ้ำ" = ถามสิ่งเดียวกันด้วยโค้ดเดียวกันหรือแทบเหมือนกัน แม้เปลี่ยนถ้อยคำ ชื่อตัวแปร หรือตัวเลขเล็กน้อย',
  '"ไม่ซ้ำ" = แนวคิดเดียวกันแต่โค้ดหรือสิ่งที่ถามต่างกันจริง',
  '',
  'ตอบเป็น JSON array ล้วน ๆ หนึ่ง object ต่อหนึ่ง item ห้ามมีข้อความอื่น:',
  '{ "index": number, "ref": string | null, "percent": number, "reason": string }',
  '- index = index ของ item ที่ได้รับ',
  '- ref = ref ของ candidate ที่ซ้ำที่สุด หรือ null ถ้าไม่ซ้ำข้อไหน',
  '- percent = ความคล้ายกับ candidate ข้อนั้น 0-100 (จำนวนเต็ม) ถ้า ref เป็น null ให้ใส่ 0',
  '- reason = เหตุผลสั้น ๆ ภาษาไทย ไม่เกิน 1 ประโยค',
].join('\n');

export function buildCheckPrompt(items: CheckItem[]): BuiltPrompt {
  const payload = items.map((item) => ({
    index: item.index,
    draft: {
      description: item.draft.description,
      code: item.draft.code ?? '',
    },
    candidates: item.candidates.map((c) => ({
      ref: refOf(c),
      description: c.description,
      code: c.code ?? '',
    })),
  }));
  return { system: SYSTEM, user: JSON.stringify(payload, null, 2) };
}

/**
 * คืน Map index → ผล; index ที่ไม่อยู่ใน Map = checker ไม่ได้ตอบ (ผู้เรียกใส่ checked=false)
 * throw เมื่อคำตอบไม่ใช่ JSON array เลย — ผู้เรียกจับแล้วถือว่าล้มทั้งชุด
 */
export function parseCheckResponse(
  text: string,
  items: CheckItem[],
): Map<number, DuplicateCheck> {
  const byIndex = new Map(items.map((i) => [i.index, i]));
  const result = new Map<number, DuplicateCheck>();

  for (const raw of extractJsonArray(text)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const item = byIndex.get(Number(r.index));
    if (!item || result.has(item.index)) continue;

    if (r.ref === null || r.ref === undefined || r.ref === '') {
      result.set(item.index, { checked: true, match: null });
      continue;
    }

    const percent = Math.round(Number(r.percent));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) continue;

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

/**
 * แถวเก่าเก็บ { exerciseId, percent } จากตอนที่ generator ประเมินเอง
 * แปลงเป็นรูปใหม่ตอนอ่าน แทนการ backfill
 */
export function normalizeSimilarity(value: unknown): DuplicateCheck | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, any>;
  if (typeof v.checked === 'boolean') return v as DuplicateCheck;
  const id = Number(v.exerciseId);
  const percent = Number(v.percent);
  if (!Number.isInteger(id) || !Number.isFinite(percent)) return null;
  return {
    checked: true,
    match: { kind: 'exercise', id, percent, reason: '', preview: '' },
  };
}
