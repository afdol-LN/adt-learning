export class SkillRegisterDto {
  skillId: string;
  pL0: number;
  pT: number;
}

export class ItemRegisterDto {
  itemId: string;
  skillId: string;
  pG: number;
  pS: number;
  difficultyLabel?: number;
}

export class AttemptRequestDto {
  studentId: string;
  itemId: string;
  correct: boolean;
}

export class AttemptResponseDto {
  studentId: string;
  itemId: string;
  skillId: string;
  pLPrior: number;
  pLPosterior: number;
  pLNext: number;
  predictedCorrectProbNext: number;
  mastered: boolean;
}

export class MasteryResponseDto {
  studentId: string;
  skillId: string;
  pL: number;
  mastered: boolean;
}
