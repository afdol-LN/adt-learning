import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { aiDraftService } from './aiDraft.service';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { Skill } from 'src/entity/skill.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Goal } from 'src/entity/goal.entity';
import { LlmClient } from 'src/libs/llm/llm.client';
import { exerciseService } from './exercise.service';
import { skillService } from './skill.service';
import { goalService } from './goal.service';
import { duplicateCheckService } from './duplicateCheck.service';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { Status } from 'src/enums/status.enum';

describe('aiDraftService — approve() transaction', () => {
  let service: aiDraftService;
  let mockAiDraftRepo: Partial<Repository<AiDraft>>;
  let mockSkillRepo: Partial<Repository<Skill>>;
  let mockExerciseRepo: Partial<Repository<Exercise>>;
  let mockGoalRepo: Partial<Repository<Goal>>;
  let mockDataSource: Partial<DataSource>;
  let mockLlmClient: Partial<LlmClient>;
  let mockExerciseSvc: Partial<exerciseService>;
  let mockSkillSvc: Partial<skillService>;
  let mockGoalSvc: Partial<goalService>;
  let mockDuplicateCheck: Partial<duplicateCheckService>;
  let mockManager: Partial<EntityManager>;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn((entityClass, entity) => Promise.resolve(entity ?? entityClass)),
    };

    mockDataSource = {
      transaction: jest.fn(async (cb: (manager: EntityManager) => Promise<any>) => {
        return await cb(mockManager as EntityManager);
      }),
    };

    mockAiDraftRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((dto) => dto as any),
    };

    mockSkillRepo = {
      find: jest.fn(),
    };

    mockExerciseRepo = {
      find: jest.fn(),
    };

    mockGoalRepo = {
      find: jest.fn(),
    };

    mockLlmClient = {
      complete: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    mockExerciseSvc = {
      createExercise: jest.fn(),
    };

    mockSkillSvc = {
      createSkillWithPrerequisite: jest.fn(),
    };

    mockGoalSvc = {
      createGoalWithSkillRequire: jest.fn(),
    };

    mockDuplicateCheck = {
      loadPool: jest.fn().mockResolvedValue([]),
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        aiDraftService,
        { provide: getRepositoryToken(AiDraft), useValue: mockAiDraftRepo },
        { provide: getRepositoryToken(Skill), useValue: mockSkillRepo },
        { provide: getRepositoryToken(Exercise), useValue: mockExerciseRepo },
        { provide: getRepositoryToken(Goal), useValue: mockGoalRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: LlmClient, useValue: mockLlmClient },
        { provide: exerciseService, useValue: mockExerciseSvc },
        { provide: skillService, useValue: mockSkillSvc },
        { provide: goalService, useValue: mockGoalSvc },
        { provide: duplicateCheckService, useValue: mockDuplicateCheck },
      ],
    }).compile();

    service = module.get<aiDraftService>(aiDraftService);
  });

  describe('generate() — duplicate checker', () => {
    const llmItem = (description: string) => ({
      description,
      skillId: 1,
      skillLevel: 2,
      type: 'FILL_IN_BLANK',
      expectTime: 30,
      fillInBlank: 'ok',
    });

    beforeEach(() => {
      (mockSkillRepo.find as jest.Mock).mockResolvedValue([
        { skillId: 1, skillCode: 'LIST', skillsName: 'List', tier: 'T1' },
      ]);
      (mockExerciseRepo.find as jest.Mock).mockResolvedValue([]);
      (mockAiDraftRepo.save as jest.Mock).mockImplementation((rows) =>
        Promise.resolve(rows),
      );
    });

    it('บันทึกผล checker ลง similarity ตามลำดับร่าง และไม่ส่งโจทย์เดิมให้ generator', async () => {
      (mockLlmClient.complete as jest.Mock).mockResolvedValue({
        text: JSON.stringify([llmItem('ข้อหนึ่ง'), llmItem('ข้อสอง')]),
        model: 'gen-model',
        candidate: 'GEN',
      });
      const flagged = {
        checked: true,
        match: { kind: 'exercise', id: 42, percent: 85, reason: 'r', preview: 'p' },
      };
      (mockDuplicateCheck.check as jest.Mock).mockResolvedValue([
        flagged,
        { checked: false, match: null },
      ]);

      const result = await service.generate(
        { entityType: AiDraftEntityType.EXERCISE, count: 2, skillId: 1 } as any,
        7,
      );

      expect(result.created).toBe(2);
      expect(mockDuplicateCheck.loadPool).toHaveBeenCalledWith([1], undefined);
      const saved = (mockAiDraftRepo.save as jest.Mock).mock.calls[0][0];
      expect(saved[0].similarity).toBe(flagged);
      expect(saved[1].similarity).toEqual({ checked: false, match: null });
      // generator ได้แค่ skill/level/sample — ไม่มีรายการโจทย์เดิมแล้ว
      const userPrompt = (mockLlmClient.complete as jest.Mock).mock.calls[0][1];
      expect(userPrompt).not.toContain('โจทย์ที่มีอยู่แล้ว');
    });

    it('ร่างที่ซ้ำตรงตัวกับร่าง pending ถูกตัดทิ้งก่อนถึง checker', async () => {
      (mockDuplicateCheck.loadPool as jest.Mock).mockResolvedValue([
        { kind: 'draft', id: 17, skillId: 1, description: 'ข้อหนึ่ง', code: null },
      ]);
      (mockLlmClient.complete as jest.Mock).mockResolvedValue({
        text: JSON.stringify([llmItem('ข้อหนึ่ง'), llmItem('ข้อสอง')]),
        model: 'gen-model',
        candidate: 'GEN',
      });
      (mockDuplicateCheck.check as jest.Mock).mockResolvedValue([
        { checked: true, match: null },
      ]);

      const result = await service.generate(
        { entityType: AiDraftEntityType.EXERCISE, count: 2, skillId: 1 } as any,
        7,
      );

      expect(result.created).toBe(1);
      expect(result.rejected[0].reason).toContain('ร่าง #17');
      expect(
        (mockDuplicateCheck.check as jest.Mock).mock.calls[0][0],
      ).toHaveLength(1);
    });
  });

  describe('approve()', () => {
    it('โยนข้อผิดพลาดหาก status ไม่ใช่ active หรือ inactive', async () => {
      await expect(service.approve(1, 'pending' as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('โยน NotFoundException หากไม่พบร่างในฐานข้อมูล', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.approve(999, Status.ACTIVE)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('โยนข้อผิดพลาดหากร่างไม่ได้อยู่ในสถานะ PENDING', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        status: AiDraftStatus.APPROVED,
        entityType: AiDraftEntityType.EXERCISE,
      });

      await expect(service.approve(1, Status.ACTIVE)).rejects.toThrow(
        'ร่างนี้ถูกตรวจไปแล้ว',
      );
    });

    it('อนุมัติร่างประเภท EXERCISE สำเร็จภายใน Transaction และส่ง manager ต่อให้ createExercise', async () => {
      const draft: Partial<AiDraft> = {
        id: 10,
        status: AiDraftStatus.PENDING,
        entityType: AiDraftEntityType.EXERCISE,
        payload: {
          description: 'test exercise',
          skillId: 1,
          skillLevel: 2,
          type: 'CHOICE',
        },
      };
      (mockManager.findOne as jest.Mock).mockResolvedValue(draft);
      (mockExerciseSvc.createExercise as jest.Mock).mockResolvedValue({
        id: 100,
        description: 'test exercise',
      });

      const result = await service.approve(10, Status.ACTIVE);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockManager.findOne).toHaveBeenCalledWith(
        AiDraft,
        expect.objectContaining({
          where: { id: 10 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(mockExerciseSvc.createExercise).toHaveBeenCalledWith(
        {
          description: 'test exercise',
          skillId: 1,
          skillLevel: 2,
          type: 'CHOICE',
          status: Status.ACTIVE,
        },
        mockManager,
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        AiDraft,
        expect.objectContaining({
          id: 10,
          status: AiDraftStatus.APPROVED,
          approvedEntityId: 100,
        }),
      );
      expect(result.status).toBe(AiDraftStatus.APPROVED);
      expect(result.approvedEntityId).toBe(100);
    });

    it('อนุมัติร่างประเภท SKILL สำเร็จและส่ง manager ต่อให้ createSkillWithPrerequisite', async () => {
      const draft: Partial<AiDraft> = {
        id: 20,
        status: AiDraftStatus.PENDING,
        entityType: AiDraftEntityType.SKILL,
        payload: {
          skillCode: 'TEST-SKILL',
          skillsName: 'Test Skill',
          prerequisites: [],
        },
      };
      (mockManager.findOne as jest.Mock).mockResolvedValue(draft);
      (mockSkillSvc.createSkillWithPrerequisite as jest.Mock).mockResolvedValue({
        skillId: 200,
        skillCode: 'TEST-SKILL',
      });

      const result = await service.approve(20, Status.INACTIVE);

      expect(mockSkillSvc.createSkillWithPrerequisite).toHaveBeenCalledWith(
        {
          skillCode: 'TEST-SKILL',
          skillsName: 'Test Skill',
          prerequisites: [],
          status: Status.INACTIVE,
        },
        mockManager,
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        AiDraft,
        expect.objectContaining({
          id: 20,
          status: AiDraftStatus.APPROVED,
          approvedEntityId: 200,
        }),
      );
      expect(result.approvedEntityId).toBe(200);
    });

    it('อนุมัติร่างประเภท GOAL สำเร็จและส่ง manager ต่อให้ createGoalWithSkillRequire', async () => {
      const draft: Partial<AiDraft> = {
        id: 30,
        status: AiDraftStatus.PENDING,
        entityType: AiDraftEntityType.GOAL,
        payload: {
          goal: 'Test Goal',
          skillRequires: [{ skillId: 1, levelRequire: 3 }],
        },
      };
      (mockManager.findOne as jest.Mock).mockResolvedValue(draft);
      (mockGoalSvc.createGoalWithSkillRequire as jest.Mock).mockResolvedValue({
        id: 300,
        goal: 'Test Goal',
      });

      const result = await service.approve(30, Status.ACTIVE);

      expect(mockGoalSvc.createGoalWithSkillRequire).toHaveBeenCalledWith(
        {
          goal: 'Test Goal',
          skillRequires: [{ skillId: 1, levelRequire: 3 }],
          status: Status.ACTIVE,
        },
        mockManager,
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        AiDraft,
        expect.objectContaining({
          id: 30,
          status: AiDraftStatus.APPROVED,
          approvedEntityId: 300,
        }),
      );
      expect(result.approvedEntityId).toBe(300);
    });

    it('เมื่อเกิดข้อผิดพลาดในการสร้าง entity ใน service transaction จะ rollback (throw error)', async () => {
      const draft: Partial<AiDraft> = {
        id: 40,
        status: AiDraftStatus.PENDING,
        entityType: AiDraftEntityType.EXERCISE,
        payload: { description: 'bad exercise', skillId: 999 },
      };
      (mockManager.findOne as jest.Mock).mockResolvedValue(draft);
      (mockExerciseSvc.createExercise as jest.Mock).mockRejectedValue(
        new BadRequestException('Skill 999 does not exist'),
      );

      await expect(service.approve(40, Status.ACTIVE)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });
});
