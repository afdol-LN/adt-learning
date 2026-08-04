import { Injectable } from '@nestjs/common';
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
