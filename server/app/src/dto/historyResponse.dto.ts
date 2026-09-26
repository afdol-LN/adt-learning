import { RestAPIResponse } from './RestAPI.dto';

export class SessionQuestionChoiceDto {
  id: number;
  script: string;
  isAnswer: boolean;
}

export class SessionQuestionHistoryDto {
  id: number; // history record id
  exerciseId: number;
  questionText: string;
  questionType: string;
  choices: SessionQuestionChoiceDto[];
  isCorrect: boolean;
  startTime: Date;
  endTime: Date;
  chosenAnswer: string | null;
  correctAnswer: string;
  isCasesensitive: string; // 'YES' or 'NO'
  /** code shown with the question (never inlined in questionText) and its language */
  code: string | null;
  language: string | null;
  /** question level, 1–5 */
  skillLevel: number | null;
  /** seconds the question is expected to take; null if unset */
  expectTime: number | null;
}

export class SessionHistoryItemDto {
  sessionId: number;
  startTime: Date;
  endTime: Date;
  isPretest: boolean;
  /** unfinished practice session — a draft the student can resume (docs/adr/0003) */
  inProgress: boolean;
  /** distinct names of the skills the session's exercises practise, in first-seen order */
  skillNames: string[];
  /** why the session ended: mastered | completed | exhausted | abandoned; null while in progress and for pretests */
  stopReason: string | null;
  /**
   * The skill's Progress (docs/adr/0001, 0004 — never raw P(L)) before the session's first answer and
   * after its last one. `progressBefore` is null when there is no earlier practice answer of that skill
   * in this branch to read it from; both are null for pretests.
   */
  progressBefore: number | null;
  progressAfter: number | null;
  questions: SessionQuestionHistoryDto[];
}

export type responseSessionHistory = RestAPIResponse<SessionHistoryItemDto[]>;
