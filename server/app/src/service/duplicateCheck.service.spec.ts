import { Repository } from 'typeorm';
import { duplicateCheckService } from './duplicateCheck.service';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { LlmClient } from 'src/libs/llm/llm.client';
import { PoolItem } from 'src/libs/llm/similarity';

describe('duplicateCheckService', () => {
  let exerciseRepo: { find: jest.Mock };
  let aiDraftRepo: { find: jest.Mock };
  let llm: { complete: jest.Mock };
  let service: duplicateCheckService;

  beforeEach(() => {
    exerciseRepo = { find: jest.fn() };
    aiDraftRepo = { find: jest.fn() };
    llm = { complete: jest.fn() };
    service = new duplicateCheckService(
      exerciseRepo as unknown as Repository<Exercise>,
      aiDraftRepo as unknown as Repository<AiDraft>,
      llm as unknown as LlmClient,
    );
  });

  describe('loadPool', () => {
    it('รวมโจทย์จริงกับร่าง pending ของ skill ที่ขอ ไม่รวมร่างที่ exclude', async () => {
      exerciseRepo.find.mockResolvedValue([
        { id: 1, skillId: 1, description: 'จริง', code: null },
      ]);
      aiDraftRepo.find.mockResolvedValue([
        { id: 10, payload: { skillId: 1, description: 'ร่าง', code: 'x = 1' } },
        { id: 11, payload: { skillId: 2, description: 'คนละ skill' } },
        { id: 12, payload: { skillId: 1, description: 'ตัวเอง' } },
      ]);

      const pool = await service.loadPool([1], 12);

      expect(pool).toEqual([
        { kind: 'exercise', id: 1, skillId: 1, description: 'จริง', code: null },
        { kind: 'draft', id: 10, skillId: 1, description: 'ร่าง', code: 'x = 1' },
      ]);
    });

    it('ไม่มี skill ไม่ query เลย', async () => {
      expect(await service.loadPool([])).toEqual([]);
      expect(exerciseRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    const pool: PoolItem[] = [
      {
        kind: 'exercise',
        id: 42,
        skillId: 1,
        description: 'list คืออะไร',
        code: null,
      },
    ];
    const near = { skillId: 1, description: 'list คืออะไรในภาษา Python' };
    const far = { skillId: 1, description: 'ฟังก์ชันเวียนเกิดทำงานอย่างไร' };

    it('ส่งเฉพาะข้อที่มีตัวเทียบ ด้วย chain check และใช้ผลของ checker', async () => {
      llm.complete.mockResolvedValue({
        text: '[{"index":0,"ref":"E42","percent":88,"reason":"ถามเรื่องเดียวกัน"}]',
        model: 'm',
        candidate: 'c',
      });

      const result = await service.check([near, far], pool);

      expect(llm.complete).toHaveBeenCalledTimes(1);
      expect(llm.complete.mock.calls[0][2]).toMatchObject({
        chain: 'check',
        temperature: 0,
      });
      const sentItems = JSON.parse(llm.complete.mock.calls[0][1]);
      expect(sentItems.map((i: { index: number }) => i.index)).toEqual([0]);
      expect(result[0]).toMatchObject({
        checked: true,
        match: { id: 42, percent: 88 },
      });
      expect(result[1]).toEqual({ checked: true, match: null });
    });

    it('ไม่มีตัวเทียบเลย ไม่เรียก LLM', async () => {
      const result = await service.check([far], pool);
      expect(llm.complete).not.toHaveBeenCalled();
      expect(result).toEqual([{ checked: true, match: null }]);
    });

    it('ไม่เทียบข้าม skill', async () => {
      await service.check([{ ...near, skillId: 2 }], pool);
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('checker ล้ม → checked=false ไม่ throw', async () => {
      llm.complete.mockRejectedValue(new Error('chain หมด'));
      const result = await service.check([near], pool);
      expect(result).toEqual([{ checked: false, match: null }]);
    });

    it('checker ไม่ตอบบางข้อ → ข้อนั้น checked=false', async () => {
      llm.complete.mockResolvedValue({ text: '[]', model: 'm', candidate: 'c' });
      const result = await service.check([near], pool);
      expect(result).toEqual([{ checked: false, match: null }]);
    });
  });
});
