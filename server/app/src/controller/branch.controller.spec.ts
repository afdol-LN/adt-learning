import { Test, TestingModule } from '@nestjs/testing';
import { branchController } from './branch.controller';
import { branchService } from 'src/service/branch.service';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';

describe('branchController', () => {
  let controller: branchController;
  let service: { create: jest.Mock };

  const makeRequest = (userId: number): AuthenRequestDto =>
    ({
      user: { userId, fullName: 'Test User', userRole: 'user' },
    }) as AuthenRequestDto;

  beforeEach(async () => {
    service = {
      create: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [branchController],
      providers: [{ provide: branchService, useValue: service }],
    }).compile();

    controller = module.get<branchController>(branchController);
  });

  it('creates a branch using the userId from the authenticated request, not the client', async () => {
    const req = makeRequest(42);

    await controller.createForSelf(req, { goalId: 7, expForGoal: 3 });

    expect(service.create).toHaveBeenCalledWith({
      userId: 42,
      goalId: 7,
      expForGoal: 3,
    });
  });

  it('ignores any userId a caller tries to smuggle in via the body', async () => {
    const req = makeRequest(42);

    // CreateBranchForSelfDto has no userId field, but nothing stops a raw
    // HTTP client from sending one — the controller must not read it.
    await controller.createForSelf(req, {
      goalId: 7,
      expForGoal: 3,
      ...({ userId: 999 } as any),
    });

    expect(service.create).toHaveBeenCalledWith({
      userId: 42,
      goalId: 7,
      expForGoal: 3,
    });
  });
});
