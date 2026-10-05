import { RestAPIResponse } from './RestAPI.dto';

// Student learning-report export (Profile → Export PDF). Only the learner's own data, and only what a
// reader of the document needs: no birth date / gender, no behaviour data, no raw P(L) (docs/adr/0001).

export interface ReportLearnerDto {
  fullName: string;
  username: string;
  campus: string | null;
  faculty: string | null;
  major: string | null;
  year: number | null;
}

export type ReportSkillStatus = 'mastered' | 'in_progress' | 'not_started';

export interface ReportSkillDto {
  skillId: number;
  name: string;
  tier: string | null;
  /** one of the goal's goalSkillRequire skills (the rest are prerequisites on the way) */
  required: boolean;
  progressPercent: number;
  status: ReportSkillStatus;
  /** Progress right after the pretest; null if no pretest was taken */
  startProgressPercent: number | null;
  /** when Progress first reached 100%; null if not mastered (or credited before any record) */
  masteredAt: string | null;
  /** practice = reached 100% by answering; pretest = credited by the pretest, never practised to it */
  masteredVia: 'practice' | 'pretest' | null;
  practiceSessions: number;
  practiceQuestions: number;
  practiceCorrect: number;
}

export interface ReportEffortDto {
  practiceSessions: number;
  /** null when the pretest was not taken */
  pretest: { correct: number; total: number; takenAt: string } | null;
  /** every answer, pretest included */
  questions: number;
  correct: number;
  accuracyPercent: number;
  /** summed answer time, each answer capped (see ANSWER_TIME_CAP_SECONDS) */
  studySeconds: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  activeDays: number;
}

export interface ReportSessionDto {
  sessionId: number;
  startTime: string;
  endTime: string;
  isPretest: boolean;
  skillNames: string[];
  correct: number;
  total: number;
  stopReason: string | null;
  inProgress: boolean;
}

export interface ReportGoalDto {
  branchId: number;
  name: string;
  description: string | null;
  startedAt: string;
  /** sticky completion time (docs/adr/0005); null while in progress */
  completedAt: string | null;
  isComplete: boolean;
  progressPercent: number;
  masteredCount: number;
  requiredCount: number;
}

/** GET /branch/:branchId/report — one goal: certificate when complete, progress report otherwise */
export interface BranchReportDto {
  documentNo: string;
  issuedAt: string;
  learner: ReportLearnerDto;
  goal: ReportGoalDto;
  skills: ReportSkillDto[];
  effort: ReportEffortDto;
  /** oldest first */
  sessions: ReportSessionDto[];
}

export interface SummaryGoalRowDto extends ReportGoalDto {
  effort: ReportEffortDto;
}

/** GET /branch/mine/report — every goal the learner has */
export interface SummaryReportDto {
  documentNo: string;
  issuedAt: string;
  learner: ReportLearnerDto;
  goals: SummaryGoalRowDto[];
  totals: ReportEffortDto & { goals: number; completedGoals: number };
}

export type responseBranchReport = RestAPIResponse<BranchReportDto>;
export type responseSummaryReport = RestAPIResponse<SummaryReportDto>;
