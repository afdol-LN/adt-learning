import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { History } from 'src/entity/history.entity';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import {
  SessionHistoryItemDto,
  SessionQuestionHistoryDto,
} from 'src/dto/historyResponse.dto';
import { BranchDashboardDto } from 'src/dto/branchDashboard.dto';
import { SkillGraph } from 'src/libs/bkt/skillGraph';

@Injectable()
export class historyService extends BaseService<History> {
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
  ) {
    super(historyRepository);
  }

  async validateBranchOwnership(
    branchId: number,
    userId: number,
    loadGoalRelation = false,
  ): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      relations: loadGoalRelation
        ? {
            goal: {
              goalSkillRequire: true,
            },
          }
        : {},
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    if (branch.userId !== userId) {
      throw new ForbiddenException(`Branch does not belong to the user`);
    }

    return branch;
  }

  async getRawHistoriesForBranch(
    branchId: number,
    userId: number,
  ): Promise<History[]> {
    await this.validateBranchOwnership(branchId, userId, false);

    return await this.historyRepository.find({
      where: { branchId },
      relations: {
        sessionAndExercise: {
          session: true,
          exercise: {
            exerciseChoices: true,
            skill: true,
          },
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  // A goal only requires a handful of skills (`goalSkillRequire`); everything
  // else in the `skill` table belongs to some other goal and must not be
  // shown/counted here. Prerequisite ancestors of a required skill are pulled
  // in too, even if not directly required, so the tree/unlock chain leading
  // up to a required skill still makes sense.
  private getRelevantSkillIds(
    allSkills: Skill[],
    goalSkillRequire: { skillId: number }[],
  ): Set<number> {
    return SkillGraph.getRelevantSkillIds(allSkills, goalSkillRequire);
  }

  async getBranchSkills(branchId: number, userId: number): Promise<any[]> {
    const branch = await this.validateBranchOwnership(branchId, userId, true);
    const histories = await this.getRawHistoriesForBranch(branchId, userId);
    const allSkills = await this.skillRepository.find({
      relations: {
        skillPrequisite: true,
      },
    });

    const relevantSkillIds = this.getRelevantSkillIds(
      allSkills,
      branch.goal?.goalSkillRequire || [],
    );

    return allSkills
      .filter((skill) => relevantSkillIds.has(skill.skillId))
      .map((skill) => {
        const skillHistories = histories.filter(
          (h) => h.sessionAndExercise?.exercise?.skillId === skill.skillId,
        );
        const total = skillHistories.length;
        const correct = skillHistories.filter((h) => h.isCorrect).length;
        const progressPercent =
          total > 0
            ? Math.min(100, Math.round((correct / total / 0.75) * 100))
            : 0;

        return {
          skillId: skill.skillId,
          skillCode: skill.skillCode,
          skillsName: skill.skillsName,
          tier: skill.tier,
          status: skill.status,
          progressPercent,
          skillPrequisite: skill.skillPrequisite.map((p) => ({
            skillId: p.skillId,
            prerequisiteSkillId: p.prerequisiteSkillId,
            prerequisiteLevel: p.prerequisiteLevel,
          })),
        };
      });
  }

  async getBranchStats(
    branchId: number,
    userId: number,
  ): Promise<BranchDashboardDto> {
    const branch = await this.validateBranchOwnership(branchId, userId, true);
    const histories = await this.historyRepository.find({
      where: { branchId },
      relations: {
        sessionAndExercise: {
          exercise: true,
        },
      },
    });

    const allSkills = await this.skillRepository.find({
      relations: {
        skillPrequisite: true,
      },
    });

    // 1. Compute progress percent for all skills
    const skillProgressMap = new Map<number, number>();
    for (const skill of allSkills) {
      const skillHistories = histories.filter(
        (h) => h.sessionAndExercise?.exercise?.skillId === skill.skillId,
      );
      const total = skillHistories.length;
      const correct = skillHistories.filter((h) => h.isCorrect).length;
      const progress =
        total > 0
          ? Math.min(100, Math.round((correct / total / 0.75) * 100))
          : 0;
      skillProgressMap.set(skill.skillId, progress);
    }

    // 2. Compute skills unlocked count (100% prerequisite unlock rule),
    // scoped to skills actually required by this branch's goal (plus their
    // prerequisite ancestors) — skills belonging to other goals don't count.
    const relevantSkillIds = this.getRelevantSkillIds(
      allSkills,
      branch.goal?.goalSkillRequire || [],
    );
    let skillsUnlockedCount = 0;
    for (const skill of allSkills) {
      if (!relevantSkillIds.has(skill.skillId)) continue;
      const prereqs = skill.skillPrequisite || [];
      if (prereqs.length === 0) {
        skillsUnlockedCount++;
      } else {
        const allParentsPassed = prereqs.every((prereq) => {
          const parentProgress =
            skillProgressMap.get(prereq.prerequisiteSkillId) || 0;
          return parentProgress === 100;
        });
        if (allParentsPassed) {
          skillsUnlockedCount++;
        }
      }
    }

    // 3. Compute distinct sessions count
    const uniqueSessionIds = new Set(
      histories
        .map((h) => h.sessionAndExercise?.sessionId)
        .filter((id) => id !== undefined && id !== null),
    );
    const sessionsCount = uniqueSessionIds.size;

    // 4. Compute day streak
    const uniqueDates = Array.from(
      new Set(
        histories
          .map((h) => {
            if (!h.startTime) return null;
            const d = new Date(h.startTime);
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
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

    // 5. Compute goal progress percent (average of goal skill requires)
    const goalSkillIds = (branch.goal?.goalSkillRequire || []).map(
      (req) => req.skillId,
    );
    let goalProgressPercent = 0;
    if (goalSkillIds.length > 0) {
      const totalProgress = goalSkillIds.reduce((sum, skillId) => {
        return sum + (skillProgressMap.get(skillId) || 0);
      }, 0);
      goalProgressPercent = Math.round(totalProgress / goalSkillIds.length);
    }

    return {
      skillsUnlockedCount,
      sessionsCount,
      dayStreak,
      goalProgressPercent,
    };
  }

  async getSessionsForBranch(
    branchId: number,
    userId: number,
  ): Promise<SessionHistoryItemDto[]> {
    const histories = await this.getRawHistoriesForBranch(branchId, userId);

    const sessionsMap = new Map<number, SessionHistoryItemDto>();

    for (const history of histories) {
      const se = history.sessionAndExercise;
      if (!se) continue;

      const sessionId = se.sessionId;
      let sessionDto = sessionsMap.get(sessionId);

      if (!sessionDto) {
        sessionDto = {
          sessionId,
          startTime: history.startTime,
          endTime: history.endTime,
          isPretest: history.isPretest,
          questions: [],
        };
        sessionsMap.set(sessionId, sessionDto);
      }

      if (history.startTime < sessionDto.startTime) {
        sessionDto.startTime = history.startTime;
      }
      if (history.endTime > sessionDto.endTime) {
        sessionDto.endTime = history.endTime;
      }

      const exercise = se.exercise;
      if (!exercise) continue;

      let correctAnswer = '';
      if (exercise.type === 'CHOICE') {
        const correctChoice = exercise.exerciseChoices?.find((c) => c.isAnswer);
        correctAnswer = correctChoice ? correctChoice.script : '';
      } else {
        correctAnswer = exercise.fillInBlank || '';
      }

      const questionDto: SessionQuestionHistoryDto = {
        id: history.id,
        exerciseId: exercise.id,
        questionText: exercise.description || '',
        questionType: exercise.type || 'CHOICE',
        choices: (exercise.exerciseChoices || []).map((c) => ({
          id: c.id,
          script: c.script || '',
          isAnswer: c.isAnswer,
        })),
        isCorrect: history.isCorrect,
        startTime: history.startTime,
        endTime: history.endTime,
        chosenAnswer: history.chosenAnswer || null,
        correctAnswer,
        isCasesensitive: exercise.isCasesensitive || 'NO',
      };

      sessionDto.questions.push(questionDto);
    }

    return Array.from(sessionsMap.values()).sort(
      (a, b) => b.sessionId - a.sessionId,
    );
  }
}
