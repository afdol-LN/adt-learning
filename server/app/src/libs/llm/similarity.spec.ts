import {
  CANDIDATE_LIMIT,
  codeTokens,
  findCandidates,
  jaccard,
  PoolItem,
  similarityScore,
  textShingles,
} from './similarity';

describe('codeTokens', () => {
  it('ไม่สนชื่อตัวแปรและตัวเลข', () => {
    expect(codeTokens('total = x + 1')).toEqual(codeTokens('s = a + 5'));
    expect(codeTokens('total = x + 1')).toEqual(['ID', '=', 'ID', '+', 'NUM']);
  });

  it('ข้อความทุกแบบเป็น STR', () => {
    expect(codeTokens('print("hi")')).toEqual(codeTokens("print('bye')"));
  });

  it('คงคำสงวนไว้ — for กับ while ไม่ถูกมองว่าเหมือนกัน', () => {
    const forLoop = codeTokens('for i in range(3):\n    print(i)');
    const whileLoop = codeTokens('while i < 3:\n    print(i)');
    expect(forLoop).toContain('for');
    expect(whileLoop).toContain('while');
    expect(forLoop).not.toContain('while');
  });

  it('ตัด comment ทิ้ง', () => {
    expect(codeTokens('x = 1  # ตั้งค่า')).toEqual(codeTokens('x = 1'));
  });

  it('โค้ดว่างได้ array ว่าง', () => {
    expect(codeTokens(null)).toEqual([]);
    expect(codeTokens('')).toEqual([]);
  });
});

describe('textShingles + jaccard', () => {
  it('หั่นข้อความไทยเป็นชิ้นละ 3 ตัวอักษรโดยไม่สนช่องว่าง', () => {
    expect([...textShingles('หาผล รวม')]).toEqual([
      ...textShingles('หาผลรวม'),
    ]);
    expect(textShingles('หาผลรวม').size).toBe(5);
  });

  it('หาผลรวม กับ หาผลคูณ ตรงกัน 2 จาก 8 ชิ้น', () => {
    expect(jaccard(textShingles('หาผลรวม'), textShingles('หาผลคูณ'))).toBe(
      0.25,
    );
  });

  it('ทั้งสองฝั่งว่างได้ 0 ไม่ใช่ NaN', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('similarityScore', () => {
  const draft = {
    description: 'ผลลัพธ์ของโค้ดนี้คืออะไร',
    code: 'total = 0\nfor n in range(3):\n    total = total + n\nprint(total)',
  };

  it('เปลี่ยนแค่ชื่อตัวแปรและถ้อยคำ ยังได้คะแนนสูงกว่าโจทย์ที่ถามเหมือนแต่โค้ดคนละแบบ', () => {
    const renamed = similarityScore(draft, {
      description: 'โค้ดนี้แสดงผลอะไร',
      code: 's = 0\nfor i in range(5):\n    s = s + i\nprint(s)',
    });
    const otherCode = similarityScore(draft, {
      description: 'ผลลัพธ์ของโค้ดนี้คืออะไร',
      code: 'x = 0\nwhile x < 3:\n    x = x + 1\nprint(x)',
    });
    expect(renamed).toBeGreaterThan(otherCode);
  });

  it('ไม่มีโค้ดทั้งคู่ ใช้คะแนน description อย่างเดียว', () => {
    expect(
      similarityScore(
        { description: 'len ใช้ทำอะไร', code: null },
        { description: 'len ใช้ทำอะไร', code: '' },
      ),
    ).toBe(1);
  });
});

describe('findCandidates', () => {
  const item = (id: number, description: string, code = ''): PoolItem => ({
    kind: 'exercise',
    id,
    skillId: 1,
    description,
    code,
  });

  it('เรียงจากใกล้ไปไกล และตัดข้อที่ไม่เกี่ยวทิ้ง', () => {
    const result = findCandidates({ description: 'list คืออะไร', code: null }, [
      item(1, 'list คืออะไร ใช้อย่างไร'),
      item(2, 'list คืออะไร'),
      item(3, 'ฟังก์ชันเวียนเกิด'),
    ]);
    expect(result.map((c) => c.id)).toEqual([2, 1]);
    expect(result[0].score).toBe(1);
  });

  it(`คืนไม่เกิน ${CANDIDATE_LIMIT} ข้อ`, () => {
    const pool = Array.from({ length: 10 }, (_, i) => item(i, 'list คืออะไร'));
    expect(
      findCandidates({ description: 'list คืออะไร', code: null }, pool),
    ).toHaveLength(CANDIDATE_LIMIT);
  });
});
