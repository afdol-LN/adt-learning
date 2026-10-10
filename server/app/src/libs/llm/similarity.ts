/**
 * คัดตัวเทียบสำหรับ duplicate checker ด้วยโค้ดล้วน (ไม่เรียก LLM ไม่แตะ DB)
 *
 * ให้คะแนนความคล้าย 0-1 ระหว่างร่างกับโจทย์เดิม แล้วส่งเฉพาะ top-K ให้ checker
 * prompt ของ checker จึงมีขนาดคงที่ ไม่ว่าคลังโจทย์จะโตแค่ไหน
 * ไฟล์นี้แค่คัดกรอง ไม่ได้ตัดสินว่าซ้ำ — การตัดสินเป็นงานของ checker
 */

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
 * ไม่งั้น for กับ while หรือ print กับ len จะกลายเป็นตัวเดียวกัน
 */
const PY_KEEP = new Set([
  'False', 'None', 'True', 'and', 'as', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield',
  'print', 'range', 'len', 'input', 'int', 'str', 'float', 'bool', 'list',
  'dict', 'set', 'tuple', 'sum', 'min', 'max', 'abs', 'round', 'sorted',
  'reversed', 'enumerate', 'zip', 'map', 'filter', 'type',
  'append', 'extend', 'pop', 'insert', 'remove', 'index', 'count', 'sort',
  'reverse', 'split', 'join', 'strip', 'replace', 'upper', 'lower', 'find',
  'keys', 'values', 'items', 'get', 'update',
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

/** หั่นเป็นกลุ่มละ n ตัวติดกัน — กลุ่มทำให้ลำดับมีผล ไม่ใช่แค่มี token เหมือนกัน */
export function nGrams(items: string[], n: number): Set<string> {
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

/** ชิ้นที่มีทั้งสองฝั่ง / ชิ้นทั้งหมดที่ไม่ซ้ำ */
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
  const desc = jaccard(
    textShingles(a.description),
    textShingles(b.description),
  );
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
