import { AiDraftEntityType } from 'src/enums/ai-draft.enum';
import { buildPrompt, PromptInput } from './prompt.builder';

describe('buildPrompt — generator ไม่รับโจทย์เดิม', () => {
  const base: PromptInput = {
    entityType: AiDraftEntityType.EXERCISE,
    count: 3,
    skills: [{ skillId: 1, skillCode: 'LOOP', skillsName: 'Loop', tier: 'T1' }],
    samples: [{ description: 'ตัวอย่างโจทย์', skillId: 1 }],
    skillId: 1,
    skillLevel: 2,
  };

  it('ไม่มี similarTo และไม่มีรายการโจทย์ที่มีอยู่แล้ว — การเทียบซ้ำเป็นงานของ checker', () => {
    const { system, user } = buildPrompt(base);
    expect(system).not.toContain('similarTo');
    expect(user).not.toContain('similarTo');
    expect(user).not.toContain('โจทย์ที่มีอยู่แล้ว');
  });

  it('ยังสั่งให้ไม่ซ้ำกันเองในชุดเดียวกัน', () => {
    const { system } = buildPrompt(base);
    expect(system).toContain('ต้องไม่ซ้ำกันเอง');
  });

  it('ยังส่ง skill เป้าหมาย ระดับ และ sample ไปให้', () => {
    const { user } = buildPrompt(base);
    expect(user).toContain('skillId 1');
    expect(user).toContain('skillLevel) = 2');
    expect(user).toContain('ตัวอย่างโจทย์');
  });

  it('regenerate ยังส่ง avoid ไปให้', () => {
    const { user } = buildPrompt({
      ...base,
      count: 1,
      avoid: { description: 'ข้อที่อาจารย์ไม่เอา' },
    });
    expect(user).toContain('ข้อที่อาจารย์ไม่เอา');
  });
});
