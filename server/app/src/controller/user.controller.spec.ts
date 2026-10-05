import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { userController } from './user.controller';
import { userProfileService } from 'src/service/user.service';
import { authService } from 'src/service/auth.service';
import { activityService } from 'src/service/activity.service';
import { Hash } from 'src/libs/hash';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';

describe('userController', () => {
  let controller: userController;
  let userService: { update: jest.Mock };
  let activity: { getActivity: jest.Mock };

  beforeEach(async () => {
    userService = {
      update: jest.fn((id, data) => Promise.resolve({ id, ...data })),
    };
    activity = { getActivity: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [userController],
      providers: [
        { provide: userProfileService, useValue: userService },
        { provide: authService, useValue: {} },
        { provide: activityService, useValue: activity },
        { provide: Hash, useValue: {} },
      ],
    }).compile();

    controller = module.get<userController>(userController);
  });

  it('updates the profile of the authenticated user, not an arbitrary id', async () => {
    const req = {
      user: { userId: 7, fullName: 'Test User', userRole: 'user' },
    } as AuthenRequestDto;

    await controller.updateMe(req, {
      campusId: 1,
      facultyId: 2,
      majorId: 3,
      year: 2,
    });

    expect(userService.update).toHaveBeenCalledWith(7, {
      campusId: 1,
      facultyId: 2,
      majorId: 3,
      year: 2,
    });
  });

  it('wraps the activity timeline in the standard envelope', async () => {
    activity.getActivity.mockResolvedValue({ events: [], nextBefore: null });
    const res = await controller.activityTimeline({ types: 'login' });
    expect(activity.getActivity).toHaveBeenCalledWith({ types: 'login' });
    expect(res).toEqual({
      isError: false,
      data: { events: [], nextBefore: null },
      errorMessage: '',
    });
  });

  it('reports a bad activity filter as an error instead of throwing', async () => {
    activity.getActivity.mockRejectedValue(
      new BadRequestException('userId must be a positive integer'),
    );
    const res = await controller.activityTimeline({ userId: 'x' });
    expect(res.isError).toBe(true);
    expect(res.errorMessage).toBe('userId must be a positive integer');
  });
});
