import { BadRequestException } from '@nestjs/common';
import {
  extractJsonArray,
  validateExerciseDrafts,
  validateGoalDrafts,
  validateSkillDrafts,
} from './draft.validator';

describe('extractJsonArray', () => {
  it('อ่าน JSON array ธรรมดาได้', () => {
    expect(extractJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it('อ่านผ่าน code fence ได้', () => {
    const text = '```json\n[{"a":1},{"a":2}]\n```';
    expect(extractJsonArray(text)).toHaveLength(2);
  });

  it('อ่านได้แม้มีข้อความนำหน้าและต่อท้าย', () => {
    const text = 'นี่คือโจทย์ที่สร้างให้ครับ:\n[{"a":1}]\nหวังว่าจะมีประโยชน์';
    expect(extractJsonArray(text)).toEqual([{ a: 1 }]);
  });

  it('โยน error เมื่อไม่พบ array', () => {
    expect(() => extractJsonArray('ขอโทษครับ ผมสร้างให้ไม่ได้')).toThrow(
      BadRequestException,
    );
  });

  it('โยน error เมื่อ JSON พัง', () => {
    expect(() => extractJsonArray('[{"a":1,}]')).toThrow(BadRequestException);
  });

  it('โยน error เมื่อได้ข้อความว่าง', () => {
    expect(() => extractJsonArray('   ')).toThrow(BadRequestException);
  });
});

describe('validateExerciseDrafts', () => {
  const ctx = { existingSkillIds: new Set([1, 2]) };

  const validChoice = {
    description: 'ข้อใดคือการเข้าถึงสมาชิกตัวแรกของ array',
    skillId: 1,
    skillLevel: 3,
    type: 'CHOICE',
    expectTime: 60,
    choices: [
      { script: 'arr[0]', isAnswer: true },
      { script: 'arr[1]', isAnswer: false },
      { script: 'arr.first', isAnswer: false },
    ],
  };

  it('ผ่านสำหรับข้อที่ถูกต้อง', () => {
    const result = validateExerciseDrafts([validChoice], ctx);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.valid[0].choices).toHaveLength(3);
  });

  it('คัดออกเมื่อมีเฉลยมากกว่าหนึ่งข้อ', () => {
    const bad = {
      ...validChoice,
      choices: [
        { script: 'arr[0]', isAnswer: true },
        { script: 'arr[1]', isAnswer: true },
      ],
    };
    const result = validateExerciseDrafts([bad], ctx);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected[0].reason).toContain('เพียงข้อเดียว');
  });

  it('คัดออกเมื่อไม่มีเฉลยเลย', () => {
    const bad = {
      ...validChoice,
      choices: [
        { script: 'arr[0]', isAnswer: false },
        { script: 'arr[1]', isAnswer: false },
      ],
    };
    expect(validateExerciseDrafts([bad], ctx).rejected).toHaveLength(1);
  });

  it('คัดออกเมื่อมีตัวเลือกน้อยกว่า 2 ข้อ', () => {
    const bad = {
      ...validChoice,
      choices: [{ script: 'arr[0]', isAnswer: true }],
    };
    const result = validateExerciseDrafts([bad], ctx);
    expect(result.rejected[0].reason).toContain('2-4');
  });

  it('คัดออกเมื่อ script ยาวเกิน 80 ตัวอักษร', () => {
    const bad = {
      ...validChoice,
      choices: [
        { script: 'x'.repeat(81), isAnswer: true },
        { script: 'arr[1]', isAnswer: false },
      ],
    };
    const result = validateExerciseDrafts([bad], ctx);
    expect(result.rejected[0].reason).toContain('80');
  });

  it('คัดออกเมื่อ skillLevel อยู่นอกช่วง 1-5', () => {
    const result = validateExerciseDrafts(
      [{ ...validChoice, skillLevel: 7 }],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('skillLevel');
  });

  it('คัดออกเมื่อ skillId ไม่มีอยู่ในระบบ', () => {
    const result = validateExerciseDrafts(
      [{ ...validChoice, skillId: 999 }],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('999');
  });

  it('ใช้ fallbackSkillId เมื่อ LLM ไม่ได้ใส่ skillId มา', () => {
    const { skillId: _omitted, ...withoutSkillId } = validChoice;
    const result = validateExerciseDrafts([withoutSkillId], {
      ...ctx,
      fallbackSkillId: 2,
    });
    expect(result.valid[0].skillId).toBe(2);
  });

  it('คัดออกเมื่อ FILL_IN_BLANK ไม่มีคำตอบ', () => {
    const bad = {
      description: 'เติมคำตอบ',
      skillId: 1,
      skillLevel: 2,
      type: 'FILL_IN_BLANK',
      fillInBlank: '   ',
    };
    const result = validateExerciseDrafts([bad], ctx);
    expect(result.rejected[0].reason).toContain('fillInBlank');
  });

  it('ตั้ง expectTime เริ่มต้นเมื่อ LLM ไม่ได้ให้มา', () => {
    const { expectTime: _omitted, ...withoutTime } = validChoice;
    const result = validateExerciseDrafts([withoutTime], ctx);
    expect(result.valid[0].expectTime).toBe(60);
  });

  it('เก็บข้อที่ถูกไว้ ทิ้งเฉพาะข้อที่ผิดในชุดเดียวกัน', () => {
    const result = validateExerciseDrafts(
      [validChoice, { ...validChoice, skillLevel: 99 }, validChoice],
      ctx,
    );
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });
});

describe('validateSkillDrafts', () => {
  const ctx = {
    existingSkillIds: new Set([1, 2]),
    existingSkillCodes: new Set(['ARR', 'LOOP']),
  };

  it('ผ่านสำหรับ skill ที่ถูกต้อง', () => {
    const result = validateSkillDrafts(
      [
        {
          skillCode: 'ARR-2D',
          skillsName: 'อาเรย์สองมิติ',
          tier: 'T3',
          prerequisites: [{ prerequisiteSkillId: 1 }],
        },
      ],
      ctx,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].prerequisites).toEqual([
      { prerequisiteSkillId: 1 },
    ]);
  });

  it('คัดออกเมื่อ skillCode ซ้ำกับของเดิม (ไม่สนตัวพิมพ์)', () => {
    const result = validateSkillDrafts(
      [{ skillCode: 'arr', skillsName: 'อาเรย์', prerequisites: [] }],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('มีอยู่แล้ว');
  });

  it('คัดออกเมื่อ skillCode ซ้ำกันเองในชุดเดียวกัน', () => {
    const item = { skillCode: 'NEW', skillsName: 'ใหม่', prerequisites: [] };
    const result = validateSkillDrafts([item, { ...item }], ctx);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('ซ้ำกับข้ออื่น');
  });

  it('คัดออกเมื่อ skillsName ยาวเกิน 30 ตัวอักษร', () => {
    const result = validateSkillDrafts(
      [{ skillCode: 'NEW', skillsName: 'ก'.repeat(31), prerequisites: [] }],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('30');
  });

  it('คัดออกเมื่อ tier ไม่ใช่ T1-T5', () => {
    const result = validateSkillDrafts(
      [
        {
          skillCode: 'NEW',
          skillsName: 'ใหม่',
          tier: 'T9',
          prerequisites: [],
        },
      ],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('T1-T5');
  });

  it('คัดออกเมื่อ prerequisite อ้าง skillId ที่ไม่มีจริง', () => {
    const result = validateSkillDrafts(
      [
        {
          skillCode: 'NEW',
          skillsName: 'ใหม่',
          prerequisites: [{ prerequisiteSkillId: 404 }],
        },
      ],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('404');
  });
});

describe('validateGoalDrafts', () => {
  const ctx = { existingSkillIds: new Set([1, 2]) };

  it('ผ่านสำหรับ goal ที่ถูกต้อง', () => {
    const result = validateGoalDrafts(
      [
        {
          goal: 'เขียนโปรแกรมจัดการข้อมูลด้วย array',
          goalDescription: 'ใช้ array เก็บและประมวลผลข้อมูลได้',
          skillRequires: [{ skillId: 1, levelRequire: 3 }],
        },
      ],
      ctx,
    );
    expect(result.valid).toHaveLength(1);
  });

  it('คัดออกเมื่อไม่มี skillRequires', () => {
    const result = validateGoalDrafts(
      [{ goal: 'เป้าหมาย', skillRequires: [] }],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('skillRequires');
  });

  it('คัดออกเมื่อ skillRequires มี skillId ซ้ำ', () => {
    const result = validateGoalDrafts(
      [
        {
          goal: 'เป้าหมาย',
          skillRequires: [{ skillId: 1 }, { skillId: 1 }],
        },
      ],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('ซ้ำ');
  });

  it('คัดออกเมื่อ goalDescription ยาวเกิน 255 ตัวอักษร', () => {
    const result = validateGoalDrafts(
      [
        {
          goal: 'เป้าหมาย',
          goalDescription: 'ก'.repeat(256),
          skillRequires: [{ skillId: 1 }],
        },
      ],
      ctx,
    );
    expect(result.rejected[0].reason).toContain('255');
  });

  it('ตัด levelRequire ที่อยู่นอกช่วง 1-6 ทิ้ง แทนที่จะคัดทั้งข้อ', () => {
    const result = validateGoalDrafts(
      [{ goal: 'เป้าหมาย', skillRequires: [{ skillId: 1, levelRequire: 9 }] }],
      ctx,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].skillRequires[0].levelRequire).toBeUndefined();
  });
});
