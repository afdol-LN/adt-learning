import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { branchService } from './branch.service';
import { Branch } from 'src/entity/branch.entity';

describe('branchService', () => {
  let service: branchService;
  let branchRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    branchRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        branchService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
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
});
