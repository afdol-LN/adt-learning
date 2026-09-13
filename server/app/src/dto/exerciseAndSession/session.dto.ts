import { ExerciseType } from 'src/enums/exercise-type.enum';
import { SkillProgress } from 'src/libs/bkt/masteryState';

export class CreateSessionDto {
  numOfExercise?: number;
  exerciseIds?: number[];
}

export class UpdateSessionDto {
  numOfExercise?: number;
  exerciseIds?: number[];
}

export class StartSessionDto {
  branchId!: number;
  skillId!: number;
}

export class SubmitAnswerDto {
  exerciseId!: number;
  chosenAnswer?: string;
  startTime!: string;
  endTime!: string;
}

export interface NextQuestionChoiceDto {
  id: number;
  script: string;
}

export interface NextQuestionDto {
  exerciseId: number;
  description: string;
  type: ExerciseType;
  expectTime: number | null;
  /** โค้ดที่ต้องแสดงในกล่องแยกเหนือตัวเลือก */
  code: string | null;
  language: string | null;
  choices?: NextQuestionChoiceDto[];
}

export interface RecommendedSkillDto {
  skillId: number;
  skillCode: string;
  skillsName: string;
  tier: string;
  pL: number;
}

export interface StartSessionResponseDto {
  sessionId: number;
  skillId: number;
  pL: number;
  /** Same value the skill-tree node shows — what the student sees (docs/adr/0001) */
  progress: SkillProgress;
  question: NextQuestionDto;
}

export interface SessionSummaryDto {
  pLBefore: number;
  pLAfter: number;
  newlyUnlockedSkills: { skillId: number; skillsName: string }[];
  nextRecommendation: RecommendedSkillDto | null;
}

export interface SubmitAnswerResponseDto {
  isCorrect: boolean;
  pL: number;
  /** Progress after this answer — equals what the skill-tree node now shows */
  progress: SkillProgress;
  nextQuestion: NextQuestionDto | null;
  sessionEnded: boolean;
  stopReason: 'mastered' | 'completed' | 'exhausted' | null;
  summary?: SessionSummaryDto;
}
