import { AiDraftEntityType } from 'src/enums/ai-draft.enum';
import {
  DUPLICATE_SIMILARITY_PERCENT,
  MAX_CHOICE_SCRIPT_LENGTH,
  MAX_GOAL_DESCRIPTION_LENGTH,
  MAX_SKILL_NAME_LENGTH,
} from './draft.validator';
import { DEFAULT_CODE_LANGUAGE } from 'src/enums/code-language.enum';

/**
 * ประกอบ prompt สำหรับสั่ง LLM สร้างร่าง exercise / skill / goal
 *
 * ทุก prompt จะแทรก context จริงจากฐานข้อมูล (รายชื่อ skill + ตัวอย่างของเดิม)
 * เพื่อให้ LLM อ้าง skillId ที่มีอยู่จริงได้ และเลียนสไตล์โจทย์เดิมของระบบ
 */

export interface SkillContextItem {
  skillId: number;
  skillCode: string;
  skillsName: string;
  tier: string | null;
}

/** โจทย์ที่มีอยู่แล้วใน DB — ส่งให้ LLM เทียบเพื่อไม่สร้างซ้ำ */
export interface ExistingExerciseItem {
  id: number;
  skillId: number;
  description: string;
  code: string | null;
}

/** skill = เฉพาะ skill ที่เลือก ส่งเต็ม / all = ทั้งคลัง ตัดที่ EXISTING_TEXT_LIMIT */
export type ExistingExercisesScope = 'skill' | 'all';

/**
 * เลือกโจทย์ที่จะใส่ใน prompt — โจทย์ที่ซ้ำกันจริงแทบทั้งหมดอยู่ใน skill เดียวกัน
 * จึงส่งเฉพาะ skill นั้นแบบไม่ตัด ส่วนกรณีไม่มี skillId (เรียก API ตรง / ร่างเก่า)
 * ถอยกลับไปส่งทั้งคลังแบบตัด กัน prompt บาน
 */
export function selectPromptExercises(
  items: ExistingExerciseItem[],
  skillId?: number,
): { items: ExistingExerciseItem[]; scope: ExistingExercisesScope } {
  if (skillId === undefined || skillId === null) {
    return { items, scope: 'all' };
  }
  const target = Number(skillId);
  return { items: items.filter((e) => e.skillId === target), scope: 'skill' };
}

export interface PromptInput {
  entityType: AiDraftEntityType;
  count: number;
  /** คำสั่งอิสระที่ admin พิมพ์ */
  instruction?: string;
  /** รายชื่อ skill ทั้งหมดในระบบ */
  skills: SkillContextItem[];
  /** ตัวอย่างของเดิม 3-5 รายการ ให้ LLM เลียนสไตล์ */
  samples: unknown[];
  /** เฉพาะ exercise */
  skillId?: number;
  skillLevel?: number;
  exerciseType?: 'CHOICE' | 'FILL_IN_BLANK' | 'MIXED';
  /** เฉพาะ exercise: โจทย์เดิมที่ห้ามสร้างซ้ำ — ได้จาก selectPromptExercises */
  existingExercises?: ExistingExerciseItem[];
  existingExercisesScope?: ExistingExercisesScope;
  /** payload เดิมที่ห้ามสร้างซ้ำ (ใช้ตอน regenerate รายข้อ) */
  avoid?: unknown;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * Bloom -> level 5 ระดับ (ไม่ใช่ 6)
 * เพราะ SLIP_BY_LEVEL / GUESS_LEVEL_MULTIPLIER ใน libs/bkt/questionSelection.ts
 * นิยามค่า slip/guess ไว้แค่ level 1-5 — level นอกช่วงนี้จะ fallback เป็น 3 เงียบ ๆ
 * จึงยุบ Remember กับ Understand เข้าเป็น level 1
 */
const BLOOM_TABLE = `| level | Bloom | คำกริยาที่ใช้ออกแบบโจทย์ |
| 1 | Remember / Understand | จำ, นิยาม, ระบุ, อธิบาย, สรุป, จำแนก |
| 2 | Apply | ใช้, เขียนโค้ดตามโจทย์, แก้ปัญหาตรงไปตรงมา |
| 3 | Analyze | เปรียบเทียบ, ไล่หาบั๊ก, แยกส่วนประกอบ |
| 4 | Evaluate | วิจารณ์, ให้เหตุผลเลือกทางที่ดีที่สุด |
| 5 | Create | ออกแบบ, ประกอบขึ้นใหม่, ปรับโครงสร้างโค้ด |`;

const BASE_SYSTEM = [
  'คุณเป็นผู้ช่วยของอาจารย์ผู้ดูแลระบบเรียนรู้แบบปรับตัว (adaptive learning) วิชาการเขียนโปรแกรมภาษา Python',
  'หน้าที่ของคุณคือร่างเนื้อหาให้อาจารย์ตรวจ ไม่ใช่บันทึกลงระบบเอง',
  '',
  'กติกาการตอบที่ห้ามละเมิด:',
  '- ตอบเป็น JSON array ล้วน ๆ เท่านั้น ห้ามมีคำอธิบาย ห้ามมีข้อความนำหน้าหรือต่อท้าย',
  '- ห้ามใส่ field ที่ไม่ได้ระบุใน schema',
  '- ข้อความทั้งหมดเป็นภาษาไทย ยกเว้นโค้ด ชื่อฟังก์ชัน และศัพท์เทคนิคที่นิยมใช้ทับศัพท์',
  '- เคารพขีดจำกัดความยาวตัวอักษรอย่างเคร่งครัด ถ้าเกินจะถูกระบบตัดทิ้ง',
].join('\n');

function renderSkillTable(skills: SkillContextItem[]): string {
  if (skills.length === 0) {
    return '(ยังไม่มี skill ในระบบ)';
  }
  const rows = skills
    .map(
      (s) =>
        `| ${s.skillId} | ${s.skillCode} | ${s.skillsName} | ${s.tier ?? '-'} |`,
    )
    .join('\n');
  return `| skillId | skillCode | ชื่อ | tier |\n${rows}`;
}

function renderSamples(samples: unknown[]): string {
  if (!samples || samples.length === 0) {
    return '(ยังไม่มีตัวอย่างเดิมในระบบ — ให้ออกแบบตามมาตรฐานทั่วไป)';
  }
  return JSON.stringify(samples, null, 2);
}

/** โค้ดยาว ๆ ตัดท้าย กัน prompt บานเมื่อคลังโจทย์โตขึ้น — ส่วนต้นพอให้เทียบความซ้ำได้ */
const EXISTING_TEXT_LIMIT = 600;

function clip(text: string): string {
  return text.length > EXISTING_TEXT_LIMIT
    ? `${text.slice(0, EXISTING_TEXT_LIMIT)}…`
    : text;
}

function renderExistingExercises(
  items: ExistingExerciseItem[] = [],
  scope: ExistingExercisesScope = 'all',
): string {
  if (items.length === 0) {
    return scope === 'skill'
      ? '(skill นี้ยังไม่มีโจทย์)'
      : '(ยังไม่มีโจทย์ในระบบ)';
  }
  // skill เดียวส่งเต็ม ให้ LLM เห็นโค้ดครบทุกบรรทัด; ทั้งคลังต้องตัด กัน prompt บาน
  const text = scope === 'skill' ? (s: string) => s : clip;
  // JSON บรรทัดละข้อ — กระชับกว่า pretty-print และ \n ในโค้ดยังอ่านออก
  return items
    .map((e) =>
      JSON.stringify({
        id: e.id,
        description: text(e.description),
        code: e.code ? text(e.code) : '',
      }),
    )
    .join('\n');
}

function renderAvoid(avoid: unknown): string {
  if (!avoid) return '';
  return [
    '',
    'ห้ามสร้างซ้ำหรือใกล้เคียงกับรายการนี้ (อาจารย์ขอให้เปลี่ยนใหม่):',
    JSON.stringify(avoid, null, 2),
  ].join('\n');
}

function buildExercisePrompt(input: PromptInput): BuiltPrompt {
  const targetSkill = input.skills.find((s) => s.skillId === input.skillId);
  const typeInstruction =
    input.exerciseType === 'CHOICE'
      ? 'ทุกข้อต้องเป็น type "CHOICE"'
      : input.exerciseType === 'FILL_IN_BLANK'
        ? 'ทุกข้อต้องเป็น type "FILL_IN_BLANK"'
        : 'ผสมทั้ง "CHOICE" และ "FILL_IN_BLANK" ตามความเหมาะสมของแต่ละข้อ';

  const system = [
    BASE_SYSTEM,
    '',
    'schema ของแต่ละ object ใน array:',
    '{',
    '  "description": string,        // โจทย์',
    `  "skillId": number,            // ต้องเป็น skillId ที่มีอยู่จริงเท่านั้น`,
    '  "skillLevel": number,         // 1-5 ตามตาราง Bloom ด้านล่าง',
    '  "type": "CHOICE" | "FILL_IN_BLANK",',
    '  "expectTime": number,         // เวลาที่ควรใช้ทำข้อนี้ หน่วยวินาที',
    '  "code": string,               // โค้ดที่นักศึกษาต้องอ่าน ขึ้นบรรทัดใหม่ด้วย \\n ได้ ห้ามครอบด้วย ``` ถ้าข้อนั้นไม่ต้องใช้โค้ดให้ใส่ "" ',
    `  "language": "python",         // ภาษาของ code — ใช้ ${DEFAULT_CODE_LANGUAGE} เสมอ`,
    `  "choices": [{ "script": string, "isAnswer": boolean }],  // เฉพาะ CHOICE: 4 ตัวเลือก และ isAnswer เป็น true ได้ข้อเดียวเท่านั้น`,
    '  "fillInBlank": string,        // เฉพาะ FILL_IN_BLANK: คำตอบที่ถูก',
    '  "isCasesensitive": "YES" | "NO",  // เฉพาะ FILL_IN_BLANK',
    '  "similarTo": { "exerciseId": number, "percent": number } | null  // โจทย์เดิมที่คล้ายที่สุด (ดูกติกาด้านล่าง)',
    '}',
    '',
    'กติกาเรื่องโจทย์ซ้ำ:',
    '- ระบบจะส่ง "โจทย์ที่มีอยู่แล้วในระบบ" (id, description, code) มาให้ ห้ามสร้างโจทย์ที่ซ้ำกับข้อใดข้อหนึ่ง',
    '  "ซ้ำ" คือถามสิ่งเดียวกันด้วยโค้ดเดียวกันหรือแทบเหมือนกัน แม้จะเปลี่ยนถ้อยคำ ชื่อตัวแปร หรือตัวเลขเล็กน้อย',
    '- โจทย์ที่ "คล้าย" (แนวคิดเดียวกันแต่โค้ดหรือสิ่งที่ถามต่างกันจริง) สร้างได้',
    '- ถ้าคล้ายโจทย์เดิม ให้ใส่ similarTo เป็น id ของข้อที่คล้ายที่สุด และ percent = ความคล้ายเป็นจำนวนเต็ม 1-100',
    '  ประเมินจากทั้ง description และ code; ถ้าไม่คล้ายข้อไหนเลยให้ใส่ null',
    `- ห้ามส่งโจทย์ที่คล้ายตั้งแต่ ${DUPLICATE_SIMILARITY_PERCENT}% ขึ้นไป เพราะนับเป็นโจทย์ซ้ำและจะถูกคัดทิ้ง`,
    '- โจทย์ในชุดที่สร้างครั้งนี้ต้องไม่ซ้ำกันเองด้วย',
    '',
    'กติกาเรื่องโค้ด (สำคัญที่สุด — ผิดข้อนี้ข้อนั้นจะถูกคัดทิ้งทันที):',
    '- description ถูกแสดงเป็นข้อความธรรมดา การขึ้นบรรทัดและการเว้นวรรคจะหายหมด',
    '  จึงห้ามใส่โค้ดลงใน description เด็ดขาด โค้ดทุกบรรทัดต้องอยู่ในฟิลด์ code เท่านั้น',
    '- ถ้า description เอ่ยถึงโค้ด (เช่น "โค้ดนี้", "โปรแกรมต่อไปนี้", "ฟังก์ชันนี้")',
    '  ต้องมี code ที่ไม่ว่างเสมอ ไม่มีข้อยกเว้น',
    '- โจทย์ที่ถามว่าโค้ดให้ผลลัพธ์อะไร มีบั๊กตรงไหน หรือควรแก้อย่างไร',
    '  เป็นไปไม่ได้เลยที่จะตอบถ้าไม่เห็นโค้ด — ข้อแบบนี้ต้องมี code เสมอ',
    '- skillLevel 3-5 (Analyze / Evaluate / Create) เกือบทุกข้อต้องมี code',
    '  เพราะต้องมีของจริงให้วิเคราะห์ ไม่ใช่ถามลอย ๆ',
    '- โค้ดควรสั้น อ่านจบใน 15 บรรทัด และมีข้อมูลพอให้ตอบได้จริง',
    '',
    'ข้อกำหนดภาษาโปรแกรม (สำคัญอย่างยิ่ง):',
    '- โจทย์ โค้ดตัวอย่างใน description และตัวเลือกคำตอบ choices/fillInBlank ทั้งหมด ต้องเป็นภาษา Python (Python 3) เท่านั้น ห้ามใช้ภาษาอื่น (เช่น C, C++, Java, JavaScript) โดยเด็ดขาด',
    '',
    'ขีดจำกัดความยาว:',
    `- choices[].script ยาวไม่เกิน ${MAX_CHOICE_SCRIPT_LENGTH} ตัวอักษร (สำคัญมาก ตัวเลือกต้องสั้นและกระชับ)`,
    '',
    'ตาราง Bloom สำหรับกำหนด skillLevel:',
    BLOOM_TABLE,
  ].join('\n');

  const user = [
    `สร้างโจทย์ ${input.count} ข้อ (ต้องเป็นภาษา Python เท่านั้น)`,
    'ข้อกำหนดด้านภาษา: ต้องเป็นภาษา Python (Python 3) เท่านั้น ทั้งตัวโจทย์ โค้ดประกอบ และคำตอบ',
    targetSkill
      ? `สำหรับ skill: ${targetSkill.skillsName} (skillCode ${targetSkill.skillCode}, skillId ${targetSkill.skillId})`
      : 'เลือก skill ที่เหมาะสมจากรายการด้านล่างเอง',
    input.skillLevel
      ? `ระดับความยาก (skillLevel) = ${input.skillLevel} ทุกข้อ`
      : 'กระจายระดับความยาก 1-5 ให้หลากหลาย',
    typeInstruction,
    '',
    'skill ทั้งหมดในระบบ:',
    renderSkillTable(input.skills),
    '',
    'ตัวอย่างโจทย์เดิมในระบบ (ให้เลียนสไตล์และระดับความละเอียด):',
    renderSamples(input.samples),
    '',
    input.existingExercisesScope === 'skill'
      ? 'โจทย์ที่มีอยู่แล้วใน skill นี้ (ห้ามสร้างซ้ำ — ถ้าคล้ายให้รายงานใน similarTo):'
      : 'โจทย์ที่มีอยู่แล้วในระบบ (ห้ามสร้างซ้ำ — ถ้าคล้ายให้รายงานใน similarTo):',
    renderExistingExercises(
      input.existingExercises,
      input.existingExercisesScope,
    ),
    renderAvoid(input.avoid),
    input.instruction ? `\nคำสั่งเพิ่มเติมจากอาจารย์:\n${input.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

function buildSkillPrompt(input: PromptInput): BuiltPrompt {
  const system = [
    BASE_SYSTEM,
    '',
    'schema ของแต่ละ object ใน array:',
    '{',
    '  "skillCode": string,   // รหัสสั้น ตัวพิมพ์ใหญ่ ห้ามซ้ำกับที่มีอยู่แล้ว เช่น "ARR-2D"',
    `  "skillsName": string,  // ชื่อ skill ยาวไม่เกิน ${MAX_SKILL_NAME_LENGTH} ตัวอักษร (สำคัญมาก)`,
    '  "tier": "T1" | "T2" | "T3" | "T4" | "T5",  // T1 ง่ายสุด T5 ยากสุด',
    '  "prerequisites": [{ "prerequisiteSkillId": number }]  // skillId ที่ต้องเรียนก่อน ใช้เฉพาะ id ที่มีอยู่จริง ถ้าไม่มีให้ใส่ []',
    '}',
    '',
    'ห้ามให้ skill ใหม่เป็น prerequisite ของกันเอง เพราะ skill ใหม่ยังไม่มี id',
  ].join('\n');

  const user = [
    `สร้าง skill ใหม่ ${input.count} รายการ`,
    '',
    'skill ที่มีอยู่แล้วในระบบ (ห้ามสร้างซ้ำ และใช้เป็น prerequisite ได้):',
    renderSkillTable(input.skills),
    '',
    'ตัวอย่าง skill เดิม (ให้เลียนรูปแบบการตั้ง skillCode และ tier):',
    renderSamples(input.samples),
    renderAvoid(input.avoid),
    input.instruction ? `\nคำสั่งเพิ่มเติมจากอาจารย์:\n${input.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

function buildGoalPrompt(input: PromptInput): BuiltPrompt {
  const system = [
    BASE_SYSTEM,
    '',
    'schema ของแต่ละ object ใน array:',
    '{',
    '  "goal": string,             // ชื่อเป้าหมายการเรียน',
    `  "goalDescription": string,  // คำอธิบาย ยาวไม่เกิน ${MAX_GOAL_DESCRIPTION_LENGTH} ตัวอักษร`,
    '  "skillRequires": [{ "skillId": number, "levelRequire": number }]  // skill ที่ต้องผ่าน ใช้เฉพาะ skillId ที่มีอยู่จริง อย่างน้อย 1 ข้อ',
    '}',
    '',
    'levelRequire เป็นระดับ Bloom 1-6 (1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create)',
    'ระบบนี้โจทย์ base on python language'
  ].join('\n');

  const user = [
    `สร้าง goal ใหม่ ${input.count} รายการ`,
    '',
    'skill ทั้งหมดในระบบ (ใช้อ้างใน skillRequires ได้เท่านั้น):',
    renderSkillTable(input.skills),
    '',
    'ตัวอย่าง goal เดิมในระบบ:',
    renderSamples(input.samples),
    renderAvoid(input.avoid),
    input.instruction ? `\nคำสั่งเพิ่มเติมจากอาจารย์:\n${input.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  switch (input.entityType) {
    case AiDraftEntityType.EXERCISE:
      return buildExercisePrompt(input);
    case AiDraftEntityType.SKILL:
      return buildSkillPrompt(input);
    case AiDraftEntityType.GOAL:
      return buildGoalPrompt(input);
  }
}
