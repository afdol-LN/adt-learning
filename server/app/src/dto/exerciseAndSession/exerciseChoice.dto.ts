export class ExerciseChoiceInputDto {
  script!: string;
  isAnswer!: boolean;
}

export class CreateExerciseChoiceDto {
  exerciseId?: number;
  choiceNo?: number;
  script?: string;
  isAnswer: boolean;
}

export class UpdateExerciseChoiceDto {
  exerciseId?: number;
  choiceNo?: number;
  script: string;
  isAnswer: boolean;
}
