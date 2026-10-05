// Admin "ประวัติการทำโจทย์" — per-question statistics built from the `history` table.
// "Students" are counted by FIRST attempt per (user, exercise); `attemptsAll` counts every attempt.

export class ExerciseStatSummaryDto {
  exerciseId: number;
  description: string;
  skillId: number;
  skillName: string;
  level: number;
  type: string;
  totalStudents: number;
  correctStudents: number;
  wrongStudents: number;
  // 0-100, 1 decimal; null when nobody has answered yet
  correctRate: number | null;
}

export class ExerciseStatChoiceDto {
  // null for fill-in-the-blank answers (they are free text, not choice rows)
  choiceId: number | null;
  text: string;
  isCorrect: boolean;
  pickedCount: number;
}

export class ExerciseStatStudentDto {
  userId: number;
  name: string;
  // first attempt result
  isCorrect: boolean;
  attempts: number;
  firstAnswer: string | null;
  // average of (endTime - startTime) over this student's attempts
  timeSpentSec: number | null;
  // P(L) after the student's latest non-pretest answer; null if none
  latestPL: number | null;
  lastAnsweredAt: Date;
}

export class ExerciseStatDetailDto extends ExerciseStatSummaryDto {
  fullDescription: string;
  code: string | null;
  language: string | null;
  attemptsAll: number;
  choices: ExerciseStatChoiceDto[];
  students: ExerciseStatStudentDto[];
}
