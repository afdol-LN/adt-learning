// Admin "who is learning this goal / skill" — the Goal and Skill detail modals' stats tab.
// Every percentage is Progress (0-100, what students see), never raw P(L) — docs/adr/0001, 0004.

export class GoalLearnerDto {
  branchId: number;
  userId: number;
  name: string;
  username: string;
  // when the student picked this goal (branch.createdAt)
  startedAt: Date;
  pretestDone: boolean;
  // same number as the goal node on the student's tree (goalMastery / buildGoalNode)
  progressPercent: number;
  masteredCount: number;
  requiredCount: number;
  completedAt: Date | null;
  // latest non-pretest answer on any skill of this branch; null if none yet
  lastActiveAt: Date | null;
}

export class GoalLearnerStatsDto {
  goalId: number;
  goalName: string;
  requiredCount: number;
  totalLearners: number;
  completedCount: number;
  pretestDoneCount: number;
  // mean goal progress over every learner, 2 decimals truncated; null when nobody picked it
  avgProgress: number | null;
  learners: GoalLearnerDto[];
}

export class SkillLearnerDto {
  branchId: number;
  userId: number;
  name: string;
  username: string;
  goalName: string;
  // null = not started (attemptCount 0) — shown as "not started", never its pL0 percentage
  progressPercent: number | null;
  attemptCount: number;
  mastered: boolean;
  // non-pretest answers on this skill's exercises
  answered: number;
  correct: number;
  lastActiveAt: Date | null;
}

export class SkillLearnerStatsDto {
  skillId: number;
  skillName: string;
  totalLearners: number;
  masteredCount: number;
  // mean progress over learners who started, 2 decimals truncated; null when nobody started
  avgProgress: number | null;
  totalAnswered: number;
  // 0-100, 1 decimal; null when no answers
  correctRate: number | null;
  learners: SkillLearnerDto[];
}
