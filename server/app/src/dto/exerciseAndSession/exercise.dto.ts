import { Status } from 'src/enums/status.enum';

export class CreateExerciseDto {
  description: string;
  level: number;
  status?: Status;
  expectTime?: number;
  skillId: number;
  fillInBlank?: string;
  isCasesensitive?: string;
}

export class UpdateExerciseDto {
  description?: string;
  level?: number;
  status?: Status;
  expectTime?: number;
  skillId?: number;
  fillInBlank?: string;
  isCasesensitive?: string;
}

export class ResultPerExerciseDto{
  userId: number;
  exerciseId: number;
  userAnswer: string;
  isCorrect: boolean;
  startTime: string;
  endTime: string;
  
}