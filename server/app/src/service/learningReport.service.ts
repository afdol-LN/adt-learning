import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from 'src/entity/branch.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import {
  BranchReportDto,
  ReportGoalDto,
  ReportLearnerDto,
  ReportEffortDto,
  ReportSkillDto,
  ReportSessionDto,
  SummaryReportDto,
} from 'src/dto/learningReport.dto';
import {
  ReportAnswer,
  documentNo,
  effortOf,
  sessionLog,
  skillRows,
} from 'src/libs/report/learningReport';
import { historyService } from './history.service';
import { branchService } from './branch.service';

interface BuiltBranch {
  goal: ReportGoalDto;
  skills: ReportSkillDto[];
  effort: ReportEffortDto;
  sessions: ReportSessionDto[];
  answers: ReportAnswer[];
}

const tierOrder = (tier: string | null) => Number(tier?.replace(/\D/g, '')) || 99;

/**
 * Profile → Export PDF. Always the caller's own data: every read goes through the history /
 * branch services' ownership checks, and the summary only lists branches of `userId`.
 */
@Injectable()
export class learningReportService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Userprofile)
    private readonly userprofileRepository: Repository<Userprofile>,
    private readonly historyService: historyService,
    private readonly branchService: branchService,
  ) {}

  async getBranchReport(
    branchId: number,
    userId: number,
    issuedAt = new Date(),
  ): Promise<BranchReportDto> {
    // ownership first: a branch that isn't the caller's must fail before anything else is read
    await this.historyService.validateBranchOwnership(branchId, userId);
    const [learner, built] = await Promise.all([
      this.learner(userId),
      this.buildBranch(branchId, userId),
    ]);
    return {
      documentNo: documentNo('B', branchId, issuedAt),
      issuedAt: issuedAt.toISOString(),
      learner,
      goal: built.goal,
      skills: built.skills,
      effort: built.effort,
      sessions: built.sessions,
    };
  }

  async getSummaryReport(
    userId: number,
    issuedAt = new Date(),
  ): Promise<SummaryReportDto> {
    const branches = await this.branchRepository.find({
      where: { userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const [learner, built] = await Promise.all([
      this.learner(userId),
      Promise.all(branches.map((b) => this.buildBranch(b.id, userId))),
    ]);
    const totals = effortOf(built.flatMap((b) => b.answers));
    return {
      documentNo: documentNo('U', userId, issuedAt),
      issuedAt: issuedAt.toISOString(),
      learner,
      goals: built.map((b) => ({ ...b.goal, effort: b.effort })),
      totals: {
        ...totals,
        goals: built.length,
        completedGoals: built.filter((b) => b.goal.isComplete).length,
      },
    };
  }

  private async learner(userId: number): Promise<ReportLearnerDto> {
    const user = await this.userprofileRepository.findOne({
      where: { id: userId },
      relations: { campus: true, faculty: true, major: true },
    });
    if (!user) throw new NotFoundException('User not found');
    // only what a reader of the document needs (PDPA): no birth date, gender or behaviour data
    return {
      fullName: user.fullName,
      username: user.username,
      campus: user.campus?.campus ?? null,
      faculty: user.faculty?.faculty ?? null,
      major: user.major?.major ?? null,
      year: user.year ?? null,
    };
  }

  private async buildBranch(branchId: number, userId: number): Promise<BuiltBranch> {
    const [branch, tree, histories, breakdown] = await Promise.all([
      this.branchRepository.findOne({ where: { id: branchId }, relations: { goal: true } }),
      this.historyService.getBranchSkills(branchId, userId),
      this.historyService.getRawHistoriesForBranch(branchId, userId),
      this.branchService.getPretestBreakdown(branchId, userId),
    ]);
    if (!branch) throw new NotFoundException(`Branch with ID ${branchId} not found`);

    const node = tree.goal;
    const required = new Set(node?.requiredSkillIds ?? []);
    const answers: ReportAnswer[] = histories
      .filter((h) => h.sessionAndExercise)
      .map((h) => ({
        skillId: h.sessionAndExercise.exercise?.skillId ?? null,
        sessionId: h.sessionAndExercise.sessionId,
        isPretest: h.isPretest,
        isCorrect: h.isCorrect,
        pL: h.pL,
        startTime: new Date(h.startTime),
        endTime: new Date(h.endTime),
      }));

    const skills = skillRows(
      tree.skills.map((s) => ({
        skillId: s.skillId,
        name: s.skillsName,
        tier: s.tier ?? null,
        required: required.has(s.skillId),
        progressPercent: s.progressPercent,
        attemptCount: s.attemptCount,
      })),
      answers,
      new Map(breakdown.map((b) => [b.skillId, b.totalPercent])),
    ).sort(
      (a, b) =>
        Number(b.required) - Number(a.required) ||
        tierOrder(a.tier) - tierOrder(b.tier) ||
        a.name.localeCompare(b.name),
    );

    return {
      goal: {
        branchId,
        name: node?.goalName ?? branch.goal?.goal ?? '-',
        description: branch.goal?.goalDescription ?? null,
        startedAt: new Date(branch.createdAt).toISOString(),
        completedAt: node?.completedAt ?? null,
        isComplete: node?.isComplete ?? false,
        progressPercent: node?.progressPercent ?? 0,
        masteredCount: node?.masteredCount ?? 0,
        requiredCount: node?.requiredCount ?? 0,
      },
      skills,
      effort: effortOf(answers),
      sessions: sessionLog(this.historyService.buildSessionHistory(histories)),
      answers,
    };
  }
}
