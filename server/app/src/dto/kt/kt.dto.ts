export class AttemptRequestDto {
  pLCurrent!: number;
  pT!: number;
  pG!: number;
  pS!: number;
  isCorrect!: boolean;
  responseTime!: number;
  expectTime!: number;
}

export class AttemptResponseDto {
  pLPrior!: number;
  pLPosterior!: number;
  pLNext!: number;
  predictedCorrectProbNext!: number;
  mastered!: boolean;
}
