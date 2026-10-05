import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from 'src/entity/branch.entity';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { History } from 'src/entity/history.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { MasteryState, truncate2 } from 'src/libs/bkt/masteryState';
import { goalMastery } from 'src/libs/bkt/goalNode';
import {
  GoalLearnerDto,
  GoalLearnerStatsDto,
  SkillLearnerDto,
  SkillLearnerStatsDto,
} from 'src/dto/learnerStats.dto';

interface BranchActivity {
  lastAt: Date;
  answered: number;
  correct: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) =>
  values.length ? truncate2(values.reduce((s, v) => s + v, 0) / values.length) : null;

/**
 * Admin stats for one goal (who picked it, how far along) and one skill (who practised it,
 * their progress). Progress always comes from the same functions the student's screens use
 * (goalMastery, MasteryState) so admin and student never see different numbers.
 * A fixed number of queries per request — aggregation happens in memory (no N+1).
 */
@Injectable()
export class learnerStatsService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
  ) {}

  private async pL0BySkillId(): Promise<Map<number, number>> {
    const skills = await this.skillRepository.find({
      select: { skillId: true, pL0: true },
    });
    return new Map(skills.map((s) => [s.skillId, s.pL0]));
  }

  // Latest answer time + answer counts per branch (practice only), optionally for one skill
  private async activityByBranch(
    branchIds: number[],
    skillId?: number,
  ): Promise<Map<number, BranchActivity>> {
    const result = new Map<number, BranchActivity>();
    if (branchIds.length === 0) return result;

    const qb = this.historyRepository
      .createQueryBuilder('h')
      .select('h.branchId', 'branchId')
      .addSelect('MAX(h.endTime)', 'lastAt')
      .addSelect('COUNT(*)', 'answered')
      .addSelect('SUM(CASE WHEN h.isCorrect THEN 1 ELSE 0 END)', 'correct')
      .where('h.branchId IN (:...branchIds)', { branchIds })
      .andWhere('h.isPretest = false')
      .groupBy('h.branchId');
    if (skillId !== undefined) {
      qb.innerJoin('h.sessionAndExercise', 'se')
        .innerJoin(Exercise, 'ex', 'ex.id = se.exerciseId')
        .andWhere('ex.skillId = :skillId', { skillId });
    }

    const rows = await qb.getRawMany<{
      branchId: number;
      lastAt: Date;
      answered: string;
      correct: string;
    }>();
    for (const r of rows) {
      result.set(Number(r.branchId), {
        lastAt: r.lastAt,
        answered: Number(r.answered),
        correct: Number(r.correct),
      });
    }
    return result;
  }

  async getGoalLearners(goalId: number): Promise<GoalLearnerStatsDto> {
    const goal = await this.goalRepository.findOne({
      where: { id: goalId },
      relations: { goalSkillRequire: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const [branches, pL0] = await Promise.all([
      this.branchRepository.find({
        where: { goalId },
        relations: { user: true },
        order: { createdAt: 'DESC' },
      }),
      this.pL0BySkillId(),
    ]);
    const activity = await this.activityByBranch(branches.map((b) => b.id));
    const skillIds = (goal.goalSkillRequire ?? []).map((r) => r.skillId);

    const learners: GoalLearnerDto[] = branches.map((b) => {
      const m = goalMastery(skillIds, b.conceptMapState, pL0);
      // same rule as buildGoalNode: a recorded completion sticks
      const isComplete = !!b.goalCompletedAt || m.allMastered;
      return {
        branchId: b.id,
        userId: b.userId,
        name: b.user?.fullName || '-',
        username: b.user?.username || '',
        startedAt: b.createdAt,
        pretestDone: b.isAlreadyPretest,
        progressPercent: isComplete ? 100 : m.progressPercent,
        masteredCount: m.masteredCount,
        requiredCount: m.requiredCount,
        completedAt: b.goalCompletedAt,
        lastActiveAt: activity.get(b.id)?.lastAt ?? null,
      };
    });
    learners.sort((a, b) => b.progressPercent - a.progressPercent);

    return {
      goalId: goal.id,
      goalName: goal.goal,
      requiredCount: goalMastery(skillIds, null, pL0).requiredCount,
      totalLearners: learners.length,
      completedCount: learners.filter((l) => l.progressPercent === 100).length,
      pretestDoneCount: learners.filter((l) => l.pretestDone).length,
      avgProgress: mean(learners.map((l) => l.progressPercent)),
      learners,
    };
  }

  async getSkillLearners(skillId: number): Promise<SkillLearnerStatsDto> {
    const skill = await this.skillRepository.findOne({ where: { skillId } });
    if (!skill) throw new NotFoundException('Skill not found');

    const branches = await this.branchRepository.find({
      relations: { user: true, goal: true },
    });
    const activity = await this.activityByBranch(
      branches.map((b) => b.id),
      skillId,
    );

    const learners: SkillLearnerDto[] = [];
    for (const b of branches) {
      const entry = MasteryState.getEntry(b.conceptMapState, skillId, skill.pL0);
      const act = activity.get(b.id);
      // "learner" = has practised this skill (or has a tracked attempt on it)
      if (entry.attemptCount === 0 && !act) continue;
      const started = entry.attemptCount > 0;
      learners.push({
        branchId: b.id,
        userId: b.userId,
        name: b.user?.fullName || '-',
        username: b.user?.username || '',
        goalName: b.goal?.goal || '-',
        progressPercent: started ? entry.progress : null,
        attemptCount: entry.attemptCount,
        mastered: entry.pL >= MasteryState.MASTERY_THRESHOLD,
        answered: act?.answered ?? 0,
        correct: act?.correct ?? 0,
        lastActiveAt: act?.lastAt ?? null,
      });
    }
    learners.sort((a, b) => (b.progressPercent ?? -1) - (a.progressPercent ?? -1));

    const totalAnswered = learners.reduce((s, l) => s + l.answered, 0);
    const totalCorrect = learners.reduce((s, l) => s + l.correct, 0);
    return {
      skillId: skill.skillId,
      skillName: skill.skillsName,
      totalLearners: learners.length,
      masteredCount: learners.filter((l) => l.mastered).length,
      avgProgress: mean(
        learners
          .map((l) => l.progressPercent)
          .filter((p): p is number => p !== null),
      ),
      totalAnswered,
      correctRate: totalAnswered ? round1((totalCorrect / totalAnswered) * 100) : null,
      learners,
    };
  }
}
