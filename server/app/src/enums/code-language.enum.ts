/**
 * ภาษาที่ code block ของโจทย์รองรับ
 *
 * ใช้ร่วมกัน 3 ที่: validator ฝั่ง AI draft, dropdown ในฟอร์ม admin,
 * และรายการภาษาที่ CodeBlock ฝั่ง frontend ลงทะเบียนกับ highlight.js
 * ถ้าเพิ่มภาษาใหม่ที่นี่ ต้องไป registerLanguage ใน CodeBlock.tsx ด้วย
 * ไม่งั้นจะแสดงเป็น plain text
 */
export enum CodeLanguage {
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  JAVA = 'java',
  C = 'c',
  CPP = 'cpp',
  SQL = 'sql',
  PLAINTEXT = 'plaintext',
}

export const SUPPORTED_CODE_LANGUAGES: string[] = Object.values(CodeLanguage);

/** ระบบนี้สอน Python เป็นหลัก จึงใช้เป็นค่าตั้งต้นเมื่อมีโค้ดแต่ไม่ระบุภาษา */
export const DEFAULT_CODE_LANGUAGE = CodeLanguage.PYTHON;

/** ตัด whitespace หัวท้ายทิ้ง และแปลงโค้ดว่างให้เป็น null (คอลัมน์เป็น nullable) */
export function normalizeCode(code?: string | null): string | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.replace(/\s+$/, '').replace(/^\n+/, '');
  return trimmed.trim() === '' ? null : trimmed;
}

/**
 * ไม่มีโค้ด -> ไม่ต้องมีภาษา
 * มีโค้ดแต่ระบุภาษาไม่ถูก -> ถอยไปใช้ python แทนที่จะปฏิเสธทั้งข้อ
 */
export function normalizeLanguage(
  code?: string | null,
  language?: string | null,
): string | null {
  if (!normalizeCode(code)) return null;
  const candidate = (language ?? '').trim().toLowerCase();
  return SUPPORTED_CODE_LANGUAGES.includes(candidate)
    ? candidate
    : DEFAULT_CODE_LANGUAGE;
}
