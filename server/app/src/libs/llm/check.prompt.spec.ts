import { BadRequestException } from '@nestjs/common';
import {
  buildCheckPrompt,
  CheckItem,
  normalizeSimilarity,
  parseCheckResponse,
} from './check.prompt';

const items: CheckItem[] = [
  {
    index: 0,
    draft: { description: 'ผลลัพธ์ของโค้ดนี้', code: 'print(1)' },
    candidates: [
      {
        kind: 'exercise',
        id: 42,
        skillId: 1,
        description: 'โค้ดนี้แสดงผลอะไร',
        code: 'print(2)',
        score: 0.8,
      },
      {
        kind: 'draft',
        id: 17,
        skillId: 1,
        description: 'ร่างที่รอตรวจ',
        code: null,
        score: 0.3,
      },
    ],
  },
  {
    index: 2,
    draft: { description: 'list คืออะไร', code: null },
    candidates: [
      {
        kind: 'exercise',
        id: 5,
        skillId: 1,
        description: 'list ใช้ทำอะไร',
        code: null,
        score: 0.5,
      },
    ],
  },
];

describe('buildCheckPrompt', () => {
  it('อ้างตัวเทียบด้วย ref E/D และไม่ส่งคะแนนของโค้ดไปให้', () => {
    const { user } = buildCheckPrompt(items);
    expect(user).toContain('"ref": "E42"');
    expect(user).toContain('"ref": "D17"');
    expect(user).not.toContain('score');
  });
});

describe('parseCheckResponse', () => {
  it('อ่านผลปกติ และเติม preview จากตัวเทียบ', () => {
    const result = parseCheckResponse(
      '[{"index":0,"ref":"E42","percent":85,"reason":"โค้ดเดียวกัน"},{"index":2,"ref":null,"percent":0,"reason":"คนละเรื่อง"}]',
      items,
    );
    expect(result.get(0)).toEqual({
      checked: true,
      match: {
        kind: 'exercise',
        id: 42,
        percent: 85,
        reason: 'โค้ดเดียวกัน',
        preview: 'โค้ดนี้แสดงผลอะไร',
      },
    });
    expect(result.get(2)).toEqual({ checked: true, match: null });
  });

  it('อ่านผ่าน code fence และข้อความนำหน้าได้', () => {
    const result = parseCheckResponse(
      'ผลตรวจครับ\n```json\n[{"index":0,"ref":"D17","percent":72,"reason":"x"}]\n```',
      items,
    );
    expect(result.get(0)?.match).toMatchObject({ kind: 'draft', id: 17 });
  });

  it('ไม่เชื่อ ref ที่ไม่ได้ส่งไปให้', () => {
    const result = parseCheckResponse(
      '[{"index":0,"ref":"E999","percent":95,"reason":"x"}]',
      items,
    );
    expect(result.has(0)).toBe(false);
  });

  it('ไม่เชื่อ percent นอกช่วง 0-100', () => {
    const result = parseCheckResponse(
      '[{"index":0,"ref":"E42","percent":140,"reason":"x"}]',
      items,
    );
    expect(result.has(0)).toBe(false);
  });

  it('ไม่เชื่อ index ที่ไม่ได้ถาม และตัด reason ที่ยาวเกิน', () => {
    const result = parseCheckResponse(
      JSON.stringify([
        { index: 9, ref: 'E42', percent: 80, reason: 'x' },
        { index: 0, ref: 'E42', percent: 80, reason: 'ก'.repeat(500) },
      ]),
      items,
    );
    expect(result.has(9)).toBe(false);
    expect(result.get(0)?.match?.reason).toHaveLength(200);
  });

  it('throw เมื่อไม่ใช่ JSON array — ผู้เรียกถือว่าล้มทั้งชุด', () => {
    expect(() => parseCheckResponse('ตรวจไม่ได้ครับ', items)).toThrow(
      BadRequestException,
    );
  });
});

describe('normalizeSimilarity', () => {
  it('แปลงแถวเก่า { exerciseId, percent } เป็นรูปใหม่', () => {
    expect(normalizeSimilarity({ exerciseId: 3, percent: 62 })).toEqual({
      checked: true,
      match: { kind: 'exercise', id: 3, percent: 62, reason: '', preview: '' },
    });
  });

  it('รูปใหม่คืนตามเดิม และ null คืน null', () => {
    const value = { checked: false, match: null };
    expect(normalizeSimilarity(value)).toBe(value);
    expect(normalizeSimilarity(null)).toBeNull();
  });
});
