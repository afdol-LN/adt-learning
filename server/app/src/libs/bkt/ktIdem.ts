/**
 * KT-IDEM (Knowledge Tracing with Item Difficulty Effect Model) — one-attempt update.
 *
 * Ported 1:1 from the Python engine (btk-engine/app/models/bkt_kt_idem.py + service/kt_service.py)
 * so NestJS no longer needs an HTTP round-trip per answer.
 * P(L0)/P(T) are per skill, P(G)/P(S) are per item (exercise).
 * Calibration (pyBKT fitting of those parameters) still lives in btk-engine/app/script/calibrate.py.
 */

export const KT_MASTERY_THRESHOLD = 0.95;

export interface KtIdemInput {
  pLCurrent: number;
  pT: number;
  pG: number;
  pS: number;
  isCorrect: boolean;
  responseTime: number;
  expectTime: number;
}

export interface KtIdemResult {
  pLPrior: number;
  pLPosterior: number;
  pLNext: number;
  predictedCorrectProbNext: number;
  mastered: boolean;
}

/** ตอบเร็วกว่าหรือเท่ากับเวลาที่คาด = 1, ช้ากว่านั้นลดลงตามสัดส่วน expect/response */
export function timeRatio(responseTime: number, expectTime: number): number {
  if (responseTime <= expectTime) return 1.0;
  return expectTime / responseTime;
}

/** Bayes' rule: P(L | ผลของข้อนี้) โดยใช้ guess/slip ของข้อนั้น */
export function posteriorGivenEvidence(
  pLPrior: number,
  correct: boolean,
  pG: number,
  pS: number,
): number {
  let numerator: number;
  let denominator: number;
  if (correct) {
    numerator = pLPrior * (1 - pS);
    denominator = numerator + (1 - pLPrior) * pG;
  } else {
    numerator = pLPrior * pS;
    denominator = numerator + (1 - pLPrior) * (1 - pG);
  }
  if (denominator === 0) return pLPrior;
  return numerator / denominator;
}

/** learning transition ของ BKT ปกติ คูณด้วย time ratio */
export function applyLearningTransition(
  pLPosterior: number,
  pT: number,
  ratio: number,
): number {
  return pLPosterior + (1 - pLPosterior) * pT * ratio;
}

export function updateMastery(input: KtIdemInput): KtIdemResult {
  const pLPosterior = posteriorGivenEvidence(
    input.pLCurrent,
    input.isCorrect,
    input.pG,
    input.pS,
  );
  const ratio = timeRatio(input.responseTime, input.expectTime);
  const pLNext = applyLearningTransition(pLPosterior, input.pT, ratio);
  const predictedCorrectProbNext =
    pLNext * (1 - input.pS) + (1 - pLNext) * input.pG;

  return {
    pLPrior: input.pLCurrent,
    pLPosterior,
    pLNext,
    predictedCorrectProbNext,
    mastered: pLNext >= KT_MASTERY_THRESHOLD,
  };
}
