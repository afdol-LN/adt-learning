import { ExerciseType } from 'src/enums/exercise-type.enum';

const SLIP_BY_LEVEL: Record<number, number> = {
  1: 0.05,
  2: 0.08,
  3: 0.1,
  4: 0.14,
  5: 0.18,
};

const GUESS_LEVEL_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 0.9,
  3: 0.8,
  4: 0.7,
  5: 0.6,
};

const DEFAULT_LEVEL = 3;

export class DifficultySeed {
  static seedPS(level: number): number {
    return SLIP_BY_LEVEL[level] ?? SLIP_BY_LEVEL[DEFAULT_LEVEL];
  }

  static seedPG(type: ExerciseType, level: number, nChoices: number): number {
    const base =
      type === ExerciseType.FILL_IN_BLANK ? 0.05 : 1 / Math.max(nChoices, 1);
    const multiplier =
      GUESS_LEVEL_MULTIPLIER[level] ?? GUESS_LEVEL_MULTIPLIER[DEFAULT_LEVEL];
    return base * multiplier;
  }
}

export interface CandidateExercise {
  id: number;
  pG: number;
  pS: number;
}

export class QuestionSelector {
  static predictedCorrectProb(pL: number, pG: number, pS: number): number {
    return pL * (1 - pS) + (1 - pL) * pG;
  }

  static selectNext(
    candidates: CandidateExercise[],
    pL: number,
    target = 0.7,
  ): number | null {
    let best: CandidateExercise | null = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      const predicted = this.predictedCorrectProb(
        pL,
        candidate.pG,
        candidate.pS,
      );
      const distance = Math.abs(predicted - target);
      const isCloser = distance < bestDistance;
      const isTieBreakWinner =
        distance === bestDistance && best !== null && candidate.id < best.id;

      if (isCloser || isTieBreakWinner) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return best ? best.id : null;
  }
}
