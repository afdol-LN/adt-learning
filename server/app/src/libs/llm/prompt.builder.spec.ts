import { AiDraftEntityType } from 'src/enums/ai-draft.enum';
import {
  buildPrompt,
  ExistingExerciseItem,
  PromptInput,
  selectPromptExercises,
} from './prompt.builder';

describe('selectPromptExercises', () => {
  const items: ExistingExerciseItem[] = [
    { id: 1, skillId: 1, description: 'a', code: null },
    { id: 2, skillId: 2, description: 'b', code: null },
    { id: 3, skillId: 1, description: 'c', code: null },
  ];

  it('มี skillId → เอาเฉพาะข้อของ skill นั้น แบบ scope skill', () => {
    const result = selectPromptExercises(items, 1);
    expect(result.scope).toBe('skill');
    expect(result.items.map((e) => e.id)).toEqual([1, 3]);
  });

  it('skillId มาเป็น string จาก jsonb ก็ยังกรองถูก', () => {
    const result = selectPromptExercises(items, '2' as unknown as number);
    expect(result.items.map((e) => e.id)).toEqual([2]);
  });

  it('ไม่มี skillId → ส่งทั้งคลังแบบ scope all', () => {
    const result = selectPromptExercises(items, undefined);
    expect(result.scope).toBe('all');
    expect(result.items).toHaveLength(3);
  });
});

describe('buildPrompt — โจทย์เดิมสำหรับกันซ้ำ', () => {
  const longCode = 'x = 1\n'.repeat(200); // 1,200 ตัวอักษร
  const base: PromptInput = {
    entityType: AiDraftEntityType.EXERCISE,
    count: 1,
    skills: [{ skillId: 1, skillCode: 'LOOP', skillsName: 'Loop', tier: 'T1' }],
    samples: [],
    skillId: 1,
    existingExercises: [
      { id: 7, skillId: 1, description: 'ผลลัพธ์ของโค้ดนี้', code: longCode },
    ],
  };

  it('scope skill ส่งโค้ดเต็มไม่ตัด', () => {
    const { user } = buildPrompt({ ...base, existingExercisesScope: 'skill' });
    expect(user).toContain(JSON.stringify(longCode));
    expect(user).not.toContain('…');
    expect(user).toContain('โจทย์ที่มีอยู่แล้วใน skill นี้');
  });

  it('scope all ตัดที่ 600 ตัวอักษร', () => {
    const { user } = buildPrompt({ ...base, existingExercisesScope: 'all' });
    expect(user).not.toContain(JSON.stringify(longCode));
    expect(user).toContain(JSON.stringify(`${longCode.slice(0, 600)}…`));
  });

  it('skill ที่ยังไม่มีโจทย์ บอก LLM ตรง ๆ', () => {
    const { user } = buildPrompt({
      ...base,
      existingExercises: [],
      existingExercisesScope: 'skill',
    });
    expect(user).toContain('(skill นี้ยังไม่มีโจทย์)');
  });
});
