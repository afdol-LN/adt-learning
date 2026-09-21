import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { responseGetBranch } from 'src/dto/branch.dto';
import { Branch } from 'src/entity/branch.entity';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';

@Injectable()
export class branchService extends BaseService<Branch> {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {
    super(branchRepository);
  }

  /**
   * Onboarding: the student went back from the pretest intro and changed their
   * experience. Only the experience moves — the goal is fixed once the branch exists.
   * Ownership is part of the lookup, so another user's branch looks exactly like a
   * missing one (404) and its existence isn't leaked.
   */
  async updateExpForSelf(
    userId: number,
    branchId: number,
    expForGoal: number,
  ): Promise<{ id: number; expForGoal: number }> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, userId },
    });
    if (!branch) throw new NotFoundException('ไม่พบ branch นี้');

    // ValidationPipe ปิดอยู่ (main.ts) — ตรวจเองตามแบบ service อื่น
    if (!Number.isInteger(expForGoal) || expForGoal < 1 || expForGoal > 5) {
      throw new BadRequestException('expForGoal ต้องเป็นจำนวนเต็ม 1–5');
    }
    // ข้อสอบ pretest ถูกสุ่มตามระดับเดิม และผลถูก seed ลง conceptMapState แล้ว
    if (branch.isAlreadyPretest) {
      throw new BadRequestException(
        'ทำ pretest ของ branch นี้แล้ว เปลี่ยนระดับประสบการณ์ไม่ได้',
      );
    }

    branch.expForGoal = expForGoal;
    await this.branchRepository.save(branch);
    return { id: branch.id, expForGoal };
  }

  async findAllForUser(userId: number): Promise<responseGetBranch> {
    try {
      const branches = await this.branchRepository.find({
        where: { userId },
        relations: {
          goal: {
            goalSkillRequire: true,
          },
        },
      });

      const response: responseGetBranch = {
        isError: false,
        data: branches.map((b) => ({
          id: b.id,
          userId: b.userId,
          goalId: b.goalId,
          expForGoal: b.expForGoal,
          isAlreadyPretest: b.isAlreadyPretest,
          goalCompletedAt: b.goalCompletedAt,
          goal: {
            id: b.goal.id,
            goal: b.goal.goal,
            goalDescription: b.goal.goalDescription,
            status: b.goal.status,
            goalSkillRequire: b.goal.goalSkillRequire.map((req) => ({
              goalId: req.goalId,
              skillId: req.skillId,
              levelRequire: req.levelRequire,
            })),
          },
        })),
        errorMassege: null,
      };

      return response;
    } catch (error) {
      return {
        isError: true,
        data: null,
        errorMassege:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
