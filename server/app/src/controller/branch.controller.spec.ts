import { Test, TestingModule } from '@nestjs/testing';
import { branchController } from './branch.controller';
import { branchService } from 'src/service/branch.service';
import { historyService } from 'src/service/history.service';
import { sessionService } from 'src/service/session.service';
import { learningReportService } from 'src/service/learningReport.service';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';

describe('branchController', () => {
  let controller: branchController;
  let service: { create: jest.Mock };
  let report: { getBranchReport: jest.Mock; getSummaryReport: jest.Mock };

  const makeRequest = (userId: number): AuthenRequestDto =>
    ({
      user: { userId, fullName: 'Test User', userRole: 'user' },
    }) as AuthenRequestDto;

  beforeEach(async () => {
    service = {
      create: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    report = {
      getBranchReport: jest.fn().mockResolvedValue({ documentNo: 'ALS-B5' }),
      getSummaryReport: jest.fn().mockResolvedValue({ documentNo: 'ALS-U42' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [branchController],
      providers: [
        { provide: branchService, useValue: service },
        // Not exercised by these tests, but the controller's constructor
        // requires them — without stubs Nest can't build the controller at all.
        { provide: historyService, useValue: {} },
        { provide: sessionService, useValue: {} },
        { provide: learningReportService, useValue: report },
      ],
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

  it('builds reports for the authenticated user only', async () => {
    await controller.getBranchReport(makeRequest(42), 5);
    await controller.getMySummaryReport(makeRequest(42));

    expect(report.getBranchReport).toHaveBeenCalledWith(5, 42);
    expect(report.getSummaryReport).toHaveBeenCalledWith(42);
  });

  it('reports another user\'s branch as an error instead of throwing', async () => {
    report.getBranchReport.mockRejectedValue(new Error('Branch does not belong to the user'));

    const res = await controller.getBranchReport(makeRequest(42), 5);

    expect(res).toEqual({
      isError: true,
      data: null,
      errorMassege: 'Branch does not belong to the user',
    });
  });
});
