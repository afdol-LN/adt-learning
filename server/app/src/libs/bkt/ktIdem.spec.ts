import {
  applyLearningTransition,
  posteriorGivenEvidence,
  timeRatio,
  updateMastery,
} from './ktIdem';

describe('ktIdem (port of btk-engine bkt_kt_idem.py)', () => {
  it('timeRatio is 1 when on time or early, expect/response when late', () => {
    expect(timeRatio(10, 20)).toBe(1);
    expect(timeRatio(20, 20)).toBe(1);
    expect(timeRatio(40, 20)).toBe(0.5);
  });

  it('posterior follows Bayes for correct and wrong answers', () => {
    // correct: 0.5*0.9 / (0.45 + 0.5*0.2) = 0.45/0.55
    expect(posteriorGivenEvidence(0.5, true, 0.2, 0.1)).toBeCloseTo(
      0.45 / 0.55,
      12,
    );
    // wrong: 0.5*0.1 / (0.05 + 0.5*0.8) = 0.05/0.45
    expect(posteriorGivenEvidence(0.5, false, 0.2, 0.1)).toBeCloseTo(
      0.05 / 0.45,
      12,
    );
  });

  it('posterior returns the prior when the denominator is 0', () => {
    expect(posteriorGivenEvidence(0, true, 0, 0.1)).toBe(0);
  });

  it('learning transition is scaled by the time ratio', () => {
    expect(applyLearningTransition(0.5, 0.2, 1)).toBeCloseTo(0.6, 12);
    expect(applyLearningTransition(0.5, 0.2, 0.5)).toBeCloseTo(0.55, 12);
  });

  it('updateMastery matches the Python engine end to end', () => {
    const res = updateMastery({
      pLCurrent: 0.5,
      pT: 0.2,
      pG: 0.2,
      pS: 0.1,
      isCorrect: true,
      responseTime: 40,
      expectTime: 20,
    });
    const posterior = 0.45 / 0.55;
    const next = posterior + (1 - posterior) * 0.2 * 0.5;
    expect(res.pLPrior).toBe(0.5);
    expect(res.pLPosterior).toBeCloseTo(posterior, 12);
    expect(res.pLNext).toBeCloseTo(next, 12);
    expect(res.predictedCorrectProbNext).toBeCloseTo(
      next * 0.9 + (1 - next) * 0.2,
      12,
    );
    expect(res.mastered).toBe(false);
  });

  it('flags mastered at P(L) >= 0.95', () => {
    const res = updateMastery({
      pLCurrent: 0.94,
      pT: 0.3,
      pG: 0.2,
      pS: 0.1,
      isCorrect: true,
      responseTime: 5,
      expectTime: 20,
    });
    expect(res.pLNext).toBeGreaterThanOrEqual(0.95);
    expect(res.mastered).toBe(true);
  });
});
