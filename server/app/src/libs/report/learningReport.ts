// Learning-report numbers (Profile → Export PDF), kept pure so they can be unit-tested.
// Progress is always the backend's (MasteryState); raw P(L) is only read here to find the moment a
// skill first crossed the mastery threshold, and never leaves this file (docs/adr/0001).
import { MasteryState } from 'src/libs/bkt/masteryState';
import type {
  ReportEffortDto,
  ReportSessionDto,
  ReportSkillDto,
} from 'src/dto/learningReport.dto';
import type { SessionHistoryItemDto } from 'src/dto/historyResponse.dto';

/** an answer left open (tab in the background) must not inflate "study time" on a certificate */
export const ANSWER_TIME_CAP_SECONDS = 10 * 60;
/** days on the document are the learner's calendar days */
export const REPORT_TIME_ZONE = 'Asia/Bangkok';

export interface ReportAnswer {
  skillId: number | null;
  sessionId: number;
  isPretest: boolean;
  isCorrect: boolean;
  pL: number | null;
  startTime: Date;
  endTime: Date;
}

export interface ReportSkillInput {
  skillId: number;
  name: string;
  tier: string | null;
  required: boolean;
  progressPercent: number;
  attemptCount: number;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** yyyy-mm-dd of `d` in the report's time zone */
export function localDay(d: Date, timeZone = REPORT_TIME_ZONE): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

export function documentNo(prefix: string, id: number, issuedAt: Date): string {
  return `ALS-${prefix}${id}-${localDay(issuedAt).replace(/-/g, '')}`;
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function skillRows(
  skills: ReportSkillInput[],
  answers: ReportAnswer[],
  startProgress: Map<number, number>,
): ReportSkillDto[] {
  const byTime = [...answers].sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
  const lastPretest = byTime.filter((a) => a.isPretest).pop() ?? null;

  return skills.map((skill) => {
    const practice = byTime.filter((a) => !a.isPretest && a.skillId === skill.skillId);
    const mastered = skill.progressPercent === 100;
    // the answer that first reached P(L) ≥ 0.95 is the moment Progress hit 100% (docs/adr/0004)
    const crossing = practice.find(
      (a) => a.pL !== null && a.pL >= MasteryState.MASTERY_THRESHOLD,
    );
    const via = !mastered ? null : crossing ? 'practice' : 'pretest';
    const masteredAt = !mastered
      ? null
      : crossing
        ? crossing.endTime
        : (lastPretest?.endTime ?? null);

    return {
      skillId: skill.skillId,
      name: skill.name,
      tier: skill.tier,
      required: skill.required,
      progressPercent: skill.progressPercent,
      // same rule as the skill tree: no attempt yet = not started, unless the pretest already credited it
      status: mastered ? 'mastered' : skill.attemptCount > 0 ? 'in_progress' : 'not_started',
      startProgressPercent: startProgress.get(skill.skillId) ?? null,
      masteredAt: iso(masteredAt),
      masteredVia: via,
      practiceSessions: new Set(practice.map((a) => a.sessionId)).size,
      practiceQuestions: practice.length,
      practiceCorrect: practice.filter((a) => a.isCorrect).length,
    };
  });
}

export function effortOf(answers: ReportAnswer[]): ReportEffortDto {
  const practice = answers.filter((a) => !a.isPretest);
  const pretest = answers.filter((a) => a.isPretest);
  const times = answers.map((a) => a.endTime.getTime());
  const correct = answers.filter((a) => a.isCorrect).length;
  const studySeconds = answers.reduce((sum, a) => {
    const s = (a.endTime.getTime() - a.startTime.getTime()) / 1000;
    return sum + Math.min(Math.max(s, 0), ANSWER_TIME_CAP_SECONDS);
  }, 0);

  return {
    practiceSessions: new Set(practice.map((a) => a.sessionId)).size,
    pretest: pretest.length
      ? {
          correct: pretest.filter((a) => a.isCorrect).length,
          total: pretest.length,
          takenAt: new Date(Math.max(...pretest.map((a) => a.endTime.getTime()))).toISOString(),
        }
      : null,
    questions: answers.length,
    correct,
    accuracyPercent: percent(correct, answers.length),
    studySeconds: Math.round(studySeconds),
    firstActivityAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastActivityAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    activeDays: new Set(answers.map((a) => localDay(a.endTime))).size,
  };
}

/** session cards (history service) → the document's session log, oldest first */
export function sessionLog(sessions: SessionHistoryItemDto[]): ReportSessionDto[] {
  return sessions
    .map((s) => ({
      sessionId: s.sessionId,
      startTime: new Date(s.startTime).toISOString(),
      endTime: new Date(s.endTime).toISOString(),
      isPretest: s.isPretest,
      skillNames: s.skillNames,
      correct: s.questions.filter((q) => q.isCorrect).length,
      total: s.questions.length,
      stopReason: s.stopReason,
      inProgress: s.inProgress,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
