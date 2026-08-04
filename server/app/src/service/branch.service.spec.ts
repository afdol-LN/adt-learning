import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { branchService } from './branch.service';
import { Branch } from 'src/entity/branch.entity';

describe('branchService', () => {
  let service: branchService;
  let branchRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    branchRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
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
});
