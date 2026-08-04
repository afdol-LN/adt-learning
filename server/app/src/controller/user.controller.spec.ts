import { Test, TestingModule } from '@nestjs/testing';
import { userController } from './user.controller';
import { userProfileService } from 'src/service/user.service';
import { authService } from 'src/service/auth.service';
import { Hash } from 'src/libs/hash';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';

describe('userController', () => {
  let controller: userController;
  let userService: { update: jest.Mock };

  beforeEach(async () => {
    userService = { update: jest.fn((id, data) => Promise.resolve({ id, ...data })) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [userController],
      providers: [
        { provide: userProfileService, useValue: userService },
        { provide: authService, useValue: {} },
        { provide: Hash, useValue: {} },
      ],
    }).compile();

    controller = module.get<userController>(userController);
  });

  it('updates the profile of the authenticated user, not an arbitrary id', async () => {
    const req = {
      user: { userId: 7, fullName: 'Test User', userRole: 'user' },
    } as AuthenRequestDto;

    await controller.updateMe(req, { campusId: 1, facultyId: 2, majorId: 3, year: 2 });

    expect(userService.update).toHaveBeenCalledWith(7, {
      campusId: 1,
      facultyId: 2,
      majorId: 3,
      year: 2,
    });
  });
});
