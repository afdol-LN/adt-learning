import { Status } from 'src/enums/status.enum';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import { ExerciseChoiceInputDto } from './exerciseChoice.dto';

export type IsCaseSensitive = 'YES' | 'NO';

export class CreateExerciseDto {
  description!: string;
  skillId!: number;
  skillLevel!: number;
  type!: ExerciseType;
  status?: Status;
  expectTime?: number;

  // โค้ดที่แสดงในกล่องแยกเหนือตัวเลือก ไม่ใช่ใน description
  code?: string;
  // หนึ่งใน CodeLanguage — ไม่ระบุแต่มี code จะตั้งเป็น python ให้
  language?: string;

  // Required when type === ExerciseType.FILL_IN_BLANK
  fillInBlank?: string;
  isCasesensitive?: IsCaseSensitive;

  // Required when type === ExerciseType.CHOICE
  choices?: ExerciseChoiceInputDto[];
}

export class UpdateExerciseDto {
  description?: string;
  skillId?: number;
  skillLevel?: number;
  type?: ExerciseType;
  status?: Status;
  expectTime?: number;

  code?: string;
  language?: string;

  fillInBlank?: string;
  isCasesensitive?: IsCaseSensitive;

  choices?: ExerciseChoiceInputDto[];
}

export class ResultPerExerciseDto {
  userId: number;
  exerciseId: number;
  userAnswer: string;
  isCorrect: boolean;
  startTime: string;
  endTime: string;
}
