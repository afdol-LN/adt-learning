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
  questions: SessionQuestionHistoryDto[];
}

export type responseSessionHistory = RestAPIResponse<SessionHistoryItemDto[]>;
