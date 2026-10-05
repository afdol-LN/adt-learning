import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
import { MasteryState, ConceptMapState } from 'src/libs/bkt/masteryState';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { pickDraft } from 'src/libs/session/sessionDraft';
import { buildGoalNode } from 'src/libs/bkt/goalNode';
import { BranchSkillTreeDto } from 'src/dto/branchSkillTree.dto';

@Injectable()
export class historyService extends BaseService<History> {
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
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
    return await this.loadBranchHistories(branchId);
  }

  // every answer of a branch with what a session card needs — no ownership check, callers do that
  private async loadBranchHistories(branchId: number): Promise<History[]> {
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

  async getBranchSkills(
    branchId: number,
    userId: number,
  ): Promise<BranchSkillTreeDto> {
    const branch = await this.validateBranchOwnership(branchId, userId, true);
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
    const allSkills = await this.skillRepository.find({
      relations: {
        skillPrequisite: true,
      },
    });

    const relevantSkillIds = this.getRelevantSkillIds(
      allSkills,
      branch.goal?.goalSkillRequire || [],
    );

    // Drafts (docs/adr/0003): per skill, the unfinished session the Exercise page will resume —
    // picked by the same rule as sessionService, so the badge and the resume always agree
    const openSessions = await this.sessionRepository.find({
      where: { branchId, endedAt: IsNull() },
      relations: { exerciseRelate: true },
    });
    const draftAnsweredBySkill = new Map<number, number>();
    for (const skillId of new Set(openSessions.map((s) => s.skillId))) {
      const draft = pickDraft(
        openSessions
          .filter((s) => s.skillId === skillId)
          .map((s) => ({ id: s.id, answeredCount: s.exerciseRelate?.length ?? 0 })),
      );
      if (draft) draftAnsweredBySkill.set(skillId, draft.answeredCount);
    }

    const skills = allSkills
      .filter((skill) => relevantSkillIds.has(skill.skillId))
      .map((skill) => {
        const entry = MasteryState.getEntry(
          conceptMapState,
          skill.skillId,
          skill.pL0,
        );

        return {
          skillId: skill.skillId,
          skillCode: skill.skillCode,
          skillsName: skill.skillsName,
          tier: skill.tier,
          status: skill.status,
          progressPercent: entry.progress,
          attemptCount: entry.attemptCount,
          // questions answered in this skill's draft; 0 = nothing to resume
          draftAnsweredCount: draftAnsweredBySkill.get(skill.skillId) ?? 0,
          skillPrequisite: skill.skillPrequisite.map((p) => ({
            skillId: p.skillId,
            prerequisiteSkillId: p.prerequisiteSkillId,
            prerequisiteLevel: p.prerequisiteLevel,
          })),
        };
      });

    return {
      skills,
      // every branch's tree ends in a goal node, derived here on each read (docs/adr/0005)
      goal: buildGoalNode(
        branch.goal,
        conceptMapState,
        new Map(allSkills.map((s) => [s.skillId, s.pL0])),
        branch.goalCompletedAt,
      ),
    };
  }

  async getBranchStats(
    branchId: number,
    userId: number,
  ): Promise<BranchDashboardDto> {
    const branch = await this.validateBranchOwnership(branchId, userId, true);
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
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

    // 1. Goal progress — the very numbers the goal node shows, from one computation (docs/adr/0005)
    const goalNode = buildGoalNode(
      branch.goal,
      conceptMapState,
      new Map(allSkills.map((s) => [s.skillId, s.pL0])),
      branch.goalCompletedAt,
    );

    // 2. Skills unlocked count (every prerequisite at pL >= 0.95), scoped to
    // this branch's goal (plus prerequisite ancestors)
    const relevantSkillIds = this.getRelevantSkillIds(
      allSkills,
      branch.goal?.goalSkillRequire || [],
    );
    let skillsUnlockedCount = 0;
    for (const skill of allSkills) {
      if (!relevantSkillIds.has(skill.skillId)) continue;
      const prereqs = skill.skillPrequisite || [];
      const allParentsMastered = prereqs.every((prereq) => {
        const parentEntry = MasteryState.getEntry(
          conceptMapState,
          prereq.prerequisiteSkillId,
          allSkills.find((s) => s.skillId === prereq.prerequisiteSkillId)
            ?.pL0 ?? 0.25,
        );
        return parentEntry.pL >= MasteryState.MASTERY_THRESHOLD;
      });
      if (allParentsMastered) skillsUnlockedCount++;
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

    return {
      skillsUnlockedCount,
      sessionsCount,
      dayStreak,
      goalProgressPercent: goalNode?.progressPercent ?? 0,
      goalMasteredCount: goalNode?.masteredCount ?? 0,
      goalRequiredCount: goalNode?.requiredCount ?? 0,
      goalComplete: goalNode?.isComplete ?? false,
    };
  }

  async getSessionsForBranch(
    branchId: number,
    userId: number,
  ): Promise<SessionHistoryItemDto[]> {
    const histories = await this.getRawHistoriesForBranch(branchId, userId);
    return this.buildSessionHistory(histories);
  }

  /**
   * One session, shaped exactly like a student's history card, for the admin History tab.
   * Admin-only (the route is guarded), so there is no ownership check. The whole branch is loaded
   * because the session's `progressBefore` comes from the answers saved before it.
   */
  async getSessionDetail(sessionId: number): Promise<SessionHistoryItemDto> {
    const anyAnswer = await this.historyRepository.findOne({
      where: { sessionAndExercise: { sessionId } },
      select: { id: true, branchId: true },
    });
    if (!anyAnswer) {
      throw new NotFoundException(`Session ${sessionId} has no answers`);
    }
    const sessions = this.buildSessionHistory(
      await this.loadBranchHistories(anyAnswer.branchId),
    );
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  // History rows (id ASC) → one card per session, newest session first
  buildSessionHistory(histories: History[]): SessionHistoryItemDto[] {
    const sessionsMap = new Map<number, SessionHistoryItemDto>();
    // Rows come in the order they were saved (id ASC). Walking them in order, this holds each skill's
    // P(L) after its latest practice answer so far — i.e. the "before" of the next session of that skill.
    // Pretest rows are left out: their P(L) isn't the skill's practice mastery.
    const lastPracticePL = new Map<number, number>();

    for (const history of histories) {
      const se = history.sessionAndExercise;
      if (!se) continue;

      const sessionId = se.sessionId;
      let sessionDto = sessionsMap.get(sessionId);
      const skillId = se.exercise?.skillId;

      if (!sessionDto) {
        const before =
          !history.isPretest && skillId !== undefined
            ? lastPracticePL.get(skillId)
            : undefined;
        sessionDto = {
          sessionId,
          startTime: history.startTime,
          endTime: history.endTime,
          isPretest: history.isPretest,
          // an unfinished practice session is a draft the student can still resume
          inProgress:
            !history.isPretest && !!se.session && !se.session.endedAt,
          skillNames: [],
          stopReason: history.isPretest ? null : (se.session?.stopReason ?? null),
          // Progress, never raw P(L) (docs/adr/0001): MasteryState is the only place it is computed
          progressBefore:
            before !== undefined ? MasteryState.progressOf(before) : null,
          progressAfter: null,
          questions: [],
        };
        sessionsMap.set(sessionId, sessionDto);
      }

      if (!history.isPretest && skillId !== undefined && history.pL !== null) {
        lastPracticePL.set(skillId, history.pL);
        sessionDto.progressAfter = MasteryState.progressOf(history.pL);
      }

      if (history.startTime < sessionDto.startTime) {
        sessionDto.startTime = history.startTime;
      }
      if (history.endTime > sessionDto.endTime) {
        sessionDto.endTime = history.endTime;
      }

      const exercise = se.exercise;
      if (!exercise) continue;

      const skillName = exercise.skill?.skillsName;
      if (skillName && !sessionDto.skillNames.includes(skillName)) {
        sessionDto.skillNames.push(skillName);
      }

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
        code: exercise.code || null,
        language: exercise.language || null,
        skillLevel: exercise.skillLevel ?? null,
        expectTime: exercise.expectTime ?? null,
      };

      sessionDto.questions.push(questionDto);
    }

    return Array.from(sessionsMap.values()).sort(
      (a, b) => b.sessionId - a.sessionId,
    );
  }
}
