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
  /** the picked option of a CHOICE exercise — graded by this, not by its text */
  choiceId?: number;
  /** fill-in-the-blank answer; for CHOICE only a fallback for clients that send no choiceId */
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
  /** ระดับความยากของโจทย์ 1–5 — แสดงบนการ์ดคำถาม */
  skillLevel: number;
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
  /** Most questions this session can have — shown in the Exercise rules card (docs/adr/0002) */
  questionLimit: number;
  /** true when this continues the skill's draft (docs/adr/0003) */
  resumed: boolean;
  /** questions already answered in this session — the counter continues from here */
  answeredCount: number;
  /** of those, answered correctly — the session summary counts the whole session */
  correctCount: number;
  question: NextQuestionDto;
}

export interface SessionSummaryDto {
  pLBefore: number;
  pLAfter: number;
  newlyUnlockedSkills: { skillId: number; skillsName: string }[];
  nextRecommendation: RecommendedSkillDto | null;
  /** set only on the answer that completed the branch's goal — the frontend celebrates it (docs/adr/0005) */
  goalCompleted: { goalId: number; goalName: string } | null;
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
