import { ExerciseType } from 'src/enums/exercise-type.enum';
import { AdaptiveEngineLogger } from './adaptiveEngineLogger';
import { MasteryState } from './masteryState';

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
  skillLevel: number;
  pG: number;
  pS: number;
}

/**
 * Fixed Progress band per level: Progress 0–19 → 1, 20–39 → 2, 40–59 → 3, 60–79 → 4, 80–100 → 5.
 * Each entry is the lowest Progress of that level. Replaced "predicted correctness nearest 0.7",
 * which gave level 1 to everyone below pL ≈ 0.66 and then ran through 2→5 by pL ≈ 0.79, because
 * the seeded pG/pS of the levels differ far less than pL does.
 */
const LEVEL_MIN_PROGRESS = [0, 20, 40, 60, 80];

/** Within the chosen level, prefer the item the student is ~70% likely to get right. */
const WITHIN_LEVEL_TARGET = 0.7;

export class QuestionSelector {
  static predictedCorrectProb(pL: number, pG: number, pS: number): number {
    return pL * (1 - pS) + (1 - pL) * pG;
  }

  static targetLevel(pL: number): number {
    const progress = MasteryState.progressOf(pL);
    let level = 1;
    LEVEL_MIN_PROGRESS.forEach((min, i) => {
      if (progress >= min) level = i + 1;
    });
    return level;
  }

  /**
   * Deterministic — a resumed draft must get back the same question (docs/adr/0003).
   * Order: nearest level to targetLevel(pL) → easier level on a tie → predicted correctness
   * nearest WITHIN_LEVEL_TARGET → lowest id.
   */
  static selectNext(
    candidates: CandidateExercise[],
    pL: number,
    context = '',
  ): number | null {
    const target = this.targetLevel(pL);
    const rank = (c: CandidateExercise) => {
      const level = SLIP_BY_LEVEL[c.skillLevel] ? c.skillLevel : DEFAULT_LEVEL;
      return [
        Math.abs(level - target),
        level,
        Math.abs(
          this.predictedCorrectProb(pL, c.pG, c.pS) - WITHIN_LEVEL_TARGET,
        ),
        c.id,
      ];
    };

    const isBefore = (a: number[], b: number[]) => {
      const i = a.findIndex((v, k) => v !== b[k]);
      return i !== -1 && a[i] < b[i];
    };

    let best: CandidateExercise | null = null;
    let bestRank: number[] = [];
    for (const candidate of candidates) {
      const r = rank(candidate);
      if (best === null || isBefore(r, bestRank)) {
        best = candidate;
        bestRank = r;
      }
    }

    AdaptiveEngineLogger.log(
      `[next-question] ${context} candidates=${candidates.length} pL=${pL.toFixed(3)} targetLevel=${target} chosen=exercise#${best?.id ?? 'none'} level=${best?.skillLevel ?? '-'}`,
    );
    return best ? best.id : null;
  }
}
