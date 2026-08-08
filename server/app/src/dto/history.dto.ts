export class CreateHistoryDto {
  userId: number;
  sessionAndExerciseId: number;
  isCorrect?: boolean;
  isPretest?: boolean;
  startTime: string | Date;
  endTime?: string | Date;
}

export class UpdateHistoryDto {
  userId?: number;
  sessionAndExerciseId?: number;
  isCorrect?: boolean;
  isPretest?: boolean;
  startTime?: string | Date;
  endTime?: string | Date;
}
