import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { branchService } from './branch.service';
import { Branch } from 'src/entity/branch.entity';
import { History } from 'src/entity/history.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Userprofile } from 'src/entity/userprofile.entity';

describe('branchService', () => {
  let service: branchService;
  let branchRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let historyRepo: { find: jest.Mock };
  let goalSkillRequireRepo: { find: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let userprofileRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    branchRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      findOne: jest.fn(),
    };
    historyRepo = { find: jest.fn().mockResolvedValue([]) };
    goalSkillRequireRepo = { find: jest.fn().mockResolvedValue([]) };
    skillRepo = { find: jest.fn().mockResolvedValue([]) };
    userprofileRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        branchService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(History), useValue: historyRepo },
        {
          provide: getRepositoryToken(GoalSkillRequire),
          useValue: goalSkillRequireRepo,
        },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Userprofile), useValue: userprofileRepo },
      ],
    }).compile();

    service = module.get<branchService>(branchService);
  });

  it('creates a branch through the repository', async () => {
    const result = await service.create({
      userId: 1,
      goalId: 2,
      expForGoal: 3,
    });

    expect(branchRepo.create).toHaveBeenCalledWith({
      userId: 1,
      goalId: 2,
      expForGoal: 3,
    });
    expect(branchRepo.save).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ userId: 1, goalId: 2, expForGoal: 3 }),
    );
  });

  describe('updateExpForSelf', () => {
    const ownBranch = () => ({
      id: 7,
      userId: 1,
      goalId: 2,
      expForGoal: 1,
      isAlreadyPretest: false,
    });

    it("updates the experience of the caller's own branch", async () => {
      branchRepo.findOne.mockResolvedValue(ownBranch());

      const result = await service.updateExpForSelf(1, 7, 4);

      // ownership is part of the lookup, not checked after loading
      expect(branchRepo.findOne).toHaveBeenCalledWith({
        where: { id: 7, userId: 1 },
      });
      expect(branchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, expForGoal: 4 }),
      );
      expect(result).toEqual({ id: 7, expForGoal: 4 });
    });

    it("404s on someone else's branch (same as a missing one)", async () => {
      branchRepo.findOne.mockResolvedValue(null);

      await expect(service.updateExpForSelf(1, 99, 3)).rejects.toThrow(
        NotFoundException,
      );
      expect(branchRepo.save).not.toHaveBeenCalled();
    });

    it.each([0, 6, 2.5, NaN])('rejects experience %p (must be 1–5)', async (exp) => {
      branchRepo.findOne.mockResolvedValue(ownBranch());

      await expect(service.updateExpForSelf(1, 7, exp)).rejects.toThrow(
        BadRequestException,
      );
      expect(branchRepo.save).not.toHaveBeenCalled();
    });

    it('refuses once the pretest is done — the pretest was drawn at the old level', async () => {
      branchRepo.findOne.mockResolvedValue({ ...ownBranch(), isAlreadyPretest: true });

      await expect(service.updateExpForSelf(1, 7, 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(branchRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getPretestBreakdown', () => {
    const pretestedBranch = (expForGoal: number) => ({
      id: 7,
      userId: 1,
      goalId: 2,
      expForGoal,
      isAlreadyPretest: true,
    });
    // ตอบถูก ใช้ 10 วินาทีจาก expectTime 20 → speed 0.5 → ส่วน pretest = 0.1 + 0.025 = 0.125
    const answeredInTen = (skillId: number) => ({
      isCorrect: true,
      startTime: new Date('2026-09-22T10:00:00Z'),
      endTime: new Date('2026-09-22T10:00:10Z'),
      sessionAndExercise: { exercise: { skillId, expectTime: 20 } },
    });

    beforeEach(() => {
      goalSkillRequireRepo.find.mockResolvedValue([
        { goalId: 2, skillId: 10 },
        { goalId: 2, skillId: 11 },
      ]);
      skillRepo.find.mockResolvedValue([
        { skillId: 10, skillsName: 'Python Basics', tier: 'T1' },
        { skillId: 11, skillsName: 'Loops', tier: 'T2' },
      ]);
      // สาขาคอม + ปี 2 → ส่วนโปรไฟล์ = 0.05 + 0.04 = 0.09
      userprofileRepo.findOne.mockResolvedValue({
        id: 1,
        year: 2,
        major: { isAboutCs: true },
      });
      historyRepo.find.mockResolvedValue([answeredInTen(10), answeredInTen(10)]);
    });

    it('splits each skill’s starting Progress into experience, pretest and profile', async () => {
      branchRepo.findOne.mockResolvedValue(pretestedBranch(3));

      const [python, loops] = await service.getPretestBreakdown(7, 1);

      // exp 3 vs T1 → base 0.55; รวม 0.765 ไม่ชนเพดาน 0.85
      expect(python).toEqual({
        skillId: 10,
        skillsName: 'Python Basics',
        totalPercent: 80.52,
        basePercent: 57.89,
        pretestPercent: 13.15,
        profilePercent: 9.47,
        capPercent: 0,
        correct: 2,
        answered: 2,
      });
      // ไม่มีข้อใน pretest: ได้แค่พื้นฐาน (exp 3 vs T2 → 0.4) + โปรไฟล์
      expect(loops).toEqual(
        expect.objectContaining({
          totalPercent: 51.57,
          basePercent: 42.1,
          pretestPercent: 0,
          profilePercent: 9.47,
          capPercent: 0,
          correct: 0,
          answered: 0,
        }),
      );
    });

    it('reports what the 0.85 ceiling cut off, so the parts add up to the total', async () => {
      // exp 5 vs T1 → base 0.75; 0.75 + 0.125 + 0.09 = 0.965 → ถูกจำกัดที่ 0.85
      branchRepo.findOne.mockResolvedValue(pretestedBranch(5));

      const [python] = await service.getPretestBreakdown(7, 1);

      expect(python.totalPercent).toBe(89.47);
      expect(python.capPercent).toBe(12.09);
      expect(
        python.basePercent +
          python.pretestPercent +
          python.profilePercent -
          python.capPercent,
      ).toBeCloseTo(python.totalPercent, 2);
    });

    it("refuses someone else's branch", async () => {
      branchRepo.findOne.mockResolvedValue({ ...pretestedBranch(3), userId: 99 });

      await expect(service.getPretestBreakdown(7, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('404s on a missing branch', async () => {
      branchRepo.findOne.mockResolvedValue(null);

      await expect(service.getPretestBreakdown(7, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns nothing before the pretest is done', async () => {
      branchRepo.findOne.mockResolvedValue({
        ...pretestedBranch(3),
        isAlreadyPretest: false,
      });

      await expect(service.getPretestBreakdown(7, 1)).resolves.toEqual([]);
      expect(historyRepo.find).not.toHaveBeenCalled();
    });
  });
});
