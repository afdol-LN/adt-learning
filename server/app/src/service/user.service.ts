import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Userprofile } from 'src/entity/userprofile.entity';
import { responseUser } from 'src/type/user.interface';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { fillAllForAdminManageResponseDto } from 'src/dto/fillAllForAdminManage.dto';
import { Hash } from 'src/libs/hash';
import { UserRole } from 'src/enums/user-role.enum';
import {
  CreateUserprofileDto,
  UpdateUserprofileDto,
} from 'src/dto/userprofile.dto';

// import { Override } from "typescript";

@Injectable()
export class userProfileService extends BaseService<Userprofile> {
  private readonly hash: Hash = new Hash();

  constructor(
    @InjectRepository(Userprofile)
    private readonly userProfileRepository: Repository<Userprofile>,
  ) {
    super(userProfileRepository);
  }

  async findUserWithcampus(campusId: number): Promise<responseUser[]> {
    const result = await this.userProfileRepository.find({
      where: { campusId },
      relations: {
        gender: true,
        campus: true,
        faculty: true,
        major: true,
      },
    });

    return result.map((userProfile) => ({
      id: userProfile.id,
      fullName: userProfile.fullName,
      gender: userProfile.gender.gender,
      birthDate: userProfile.birthDate,
      campus: userProfile.campus.campus,
      faculty: userProfile.faculty.faculty,
      major: userProfile.major.major,
    }));
  }

  async fillAllForAdmin() {
    const result = await this.userProfileRepository.find({
      relations: {
        gender: true,
        campus: true,
        faculty: true,
        major: true,
      },
    });

    return result.map((userProfile) => ({
      id: userProfile.id,
      fullName: userProfile.fullName,
      gender: userProfile.gender.gender,
      birthDate: userProfile.birthDate,
      campus: userProfile.campus.campus,
      faculty: userProfile.faculty.faculty,
      major: userProfile.major.major,
    }));
  }

  async fillAllForAdminManage(): Promise<fillAllForAdminManageResponseDto> {
    let response: fillAllForAdminManageResponseDto;

    try {
      const result = await this.userProfileRepository.find({
        relations: {
          gender: true,
          campus: true,
          faculty: true,
          major: true,
          branches: {
            history: {
              sessionAndExercise: {
                session: true,
              },
            },
            goal: true,
          },
        },
      });
      Logger.log(result);
      if (result.length == 0) {
        response = {
          isError: true,
          data: null,
          errorMessage: 'Not found user',
        };
      } else {
        response = {
          isError: false,
          data: result.map((userProfile) => {
            const allHistories = (userProfile.branches || []).flatMap(
              (branch) => branch.history || [],
            );

            // 1. sessionCount: from different session id
            const uniqueSessionIds = new Set(
              allHistories
                .map(
                  (h) =>
                    h.sessionAndExercise?.sessionId ??
                    h.sessionAndExercise?.session?.id,
                )
                .filter((id) => id !== undefined && id !== null),
            );
            const sessionCount = uniqueSessionIds.size;

            // 2. currectPercent / correctPercent: isCorrect times divided by all history record
            const totalHistoryCount = allHistories.length;
            const correctCount = allHistories.filter((h) => h.isCorrect).length;
            const correctPercent =
              totalHistoryCount > 0
                ? Number(((correctCount / totalHistoryCount) * 100).toFixed(2))
                : 0;

            // 3. dayStreak: different day in history and day must continue
            const uniqueDates = Array.from(
              new Set(
                allHistories
                  .map((h) => {
                    if (!h.startTime) return null;
                    const d = new Date(h.startTime);
                    return isNaN(d.getTime())
                      ? null
                      : d.toISOString().split('T')[0];
                  })
                  .filter((date): date is string => Boolean(date)),
              ),
            ).sort((a, b) => b.localeCompare(a));

            let dayStreak = 0;
            if (uniqueDates.length > 0) {
              dayStreak = 1;
              for (let i = 0; i < uniqueDates.length - 1; i++) {
                const curr = new Date(uniqueDates[i]);
                const prev = new Date(uniqueDates[i + 1]);
                const diffDays = Math.round(
                  (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
                );
                if (diffDays === 1) {
                  dayStreak++;
                } else {
                  break;
                }
              }
            }

            return {
              id: userProfile.id,
              fullName: userProfile.fullName || '-',
              status: userProfile.status || '-',
              campusName: userProfile.campus?.campus || '-',
              facultyName: userProfile.faculty?.faculty || '-',
              majorName: userProfile.major?.major || '-',
              goals:
                userProfile.branches
                  ?.map((branch) => branch.goal?.goal)
                  .filter(Boolean)
                  .join('-') || '-',
              sessionCount,
              dayStreak: dayStreak,
              correctPercent: correctPercent,
              birthDate: userProfile.birthDate,
              genderId: userProfile.genderId,
              genderName: userProfile.gender?.gender || '-',
              username: userProfile.username,
              role: userProfile.role,
            };
          }),
          errorMessage: '',
        };
      }
    } catch (error) {
      Logger.error('Error in fillAllForAdminManage:', error);
      response = {
        isError: true,
        data: null,
        errorMessage: error.message || 'Internal server error',
      };
    }
    return response;
  }

  async updateUserStatus(id: number, status: string) {
    let response;
    try {
      const checkUser = await this.userProfileRepository.findOne({
        where: { id },
      });
      if (!checkUser) {
        response = {
          isError: true,
          data: null,
          errorMessage: 'User not found',
        };
      } else {
        checkUser.status = status;
        const updated = await this.userProfileRepository.save(checkUser);
        response = {
          isError: false,
          data: updated,
          errorMessage: 'Update status successful',
        };
      }
    } catch (error: any) {
      response = {
        isError: true,
        data: null,
        errorMessage: error.message || 'Internal server error',
      };
    } finally {
      return response;
    }
  }
  async getRoles() {
    return {
      isError: false,
      data: [
        { id: UserRole.USER, label: 'User / ผู้เรียน' },
        { id: UserRole.ADMIN, label: 'Admin / ผู้ดูแลระบบ' },
      ],
      errorMessage: '',
    };
  }

  async createAdminUser(userprofile: CreateUserprofileDto) {
    let response;
    try {
      const checkUser = await this.userProfileRepository.findOne({
        where: { username: userprofile.username },
      });
      if (checkUser) {
        response = {
          isError: true,
          data: null,
          errorMessage: 'Username already exists',
        };
      } else {
        const hashPassword = this.hash.hashSha256(userprofile.password);
        userprofile.password = hashPassword;
        if (!userprofile.role) {
          userprofile.role = UserRole.USER;
        }
        if (!userprofile.status) {
          userprofile.status = 'active';
        }
        const created = await this.userProfileRepository.save(userprofile);
        response = {
          isError: false,
          data: created,
          errorMessage: 'Create user successful',
        };
      }
    } catch (error: any) {
      Logger.error('Error in createAdminUser:', error);
      response = {
        isError: true,
        data: null,
        errorMessage: error.message || 'Internal server error',
      };
    }
    return response;
  }

  async updateAdminUser(id: number, data: UpdateUserprofileDto) {
    let response;
    try {
      const checkUser = await this.userProfileRepository.findOne({
        where: { id },
      });
      if (!checkUser) {
        response = {
          isError: true,
          data: null,
          errorMessage: 'User not found',
        };
        return response;
      }

      const { password, ...rest } = data;
      Object.assign(checkUser, rest);
      if (password) {
        checkUser.password = this.hash.hashSha256(password);
      }

      const updated = await this.userProfileRepository.save(checkUser);
      response = {
        isError: false,
        data: updated,
        errorMessage: 'Update user successful',
      };
    } catch (error: any) {
      Logger.error('Error in updateAdminUser:', error);
      response = {
        isError: true,
        data: null,
        errorMessage: error.message || 'Internal server error',
      };
    }
    return response;
  }
}
