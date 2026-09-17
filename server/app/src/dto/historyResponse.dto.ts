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
  questions: SessionQuestionHistoryDto[];
}

export type responseSessionHistory = RestAPIResponse<SessionHistoryItemDto[]>;
