import { PretestAnswerStat, PretestMasteryCalculator } from './pretestMastery';

// docs/adr/0006: expForGoal is self-reported, so its share of the starting P(L) shrank
// (0.75 → 0.35 at most) while the pretest keeps its 0.15, and nothing starts close to mastered.
describe('PretestMasteryCalculator', () => {
  const noProfile = { isAboutCs: false, year: 1 };
  const bestProfile = { isAboutCs: true, year: 2 };
  // answered instantly: accuracy 1, speed factor 1 → the whole pretest share
  const allRight: PretestAnswerStat[] = [
    { isCorrect: true, actualTimeSeconds: 0, expectTime: 30 },
    { isCorrect: true, actualTimeSeconds: 0, expectTime: 30 },
  ];
  const allWrong: PretestAnswerStat[] = [
    { isCorrect: false, actualTimeSeconds: 40, expectTime: 30 },
    { isCorrect: false, actualTimeSeconds: 40, expectTime: 30 },
  ];

  it.each([
    [1, 3, 0.1], // gap -2
    [1, 4, 0.1], // gap -3 still the floor
    [2, 3, 0.12], // gap -1
    [3, 3, 0.15], // gap 0
    [4, 3, 0.2], // gap +1
    [3, 1, 0.25], // gap +2
    [4, 1, 0.3], // gap +3
    [5, 1, 0.35], // gap +4 — the most self-reported experience can give
  ])('base for exp %i on a T%i skill is %d', (exp, tier, expected) => {
    expect(PretestMasteryCalculator.computePBase(exp, tier)).toBe(expected);
  });

  it('gives at most 0.05 for the profile', () => {
    expect(
      PretestMasteryCalculator.computeDeltaProfile(bestProfile),
    ).toBeCloseTo(0.05, 10);
    expect(PretestMasteryCalculator.computeDeltaProfile(noProfile)).toBe(0);
  });

  it('keeps the pretest share at up to 0.15', () => {
    expect(PretestMasteryCalculator.computeDeltaPretest(allRight)).toBeCloseTo(
      0.15,
      10,
    );
    expect(PretestMasteryCalculator.computeDeltaPretest(allWrong)).toBe(0);
  });

  it('starts even the strongest student at 0.55, below the 0.6 safety cap', () => {
    const parts = PretestMasteryCalculator.breakdown(
      5,
      1,
      allRight,
      bestProfile,
    );
    expect(parts.total).toBeCloseTo(0.55, 10);
    expect(parts.total).toBeLessThanOrEqual(0.6);
  });

  it('separates an all-right pretest from an all-wrong one by the full 0.15', () => {
    const right = PretestMasteryCalculator.computePL0(
      3,
      1,
      allRight,
      noProfile,
    );
    const wrong = PretestMasteryCalculator.computePL0(
      3,
      1,
      allWrong,
      noProfile,
    );
    expect(right - wrong).toBeCloseTo(0.15, 10);
    expect(wrong).toBeCloseTo(0.25, 10);
  });

  it('clamps expForGoal to 1–5 and treats a missing one as 3', () => {
    expect(PretestMasteryCalculator.computePBase(9, 1)).toBe(0.35);
    expect(PretestMasteryCalculator.computePBase(-4, 1)).toBe(0.15);
    expect(PretestMasteryCalculator.computePBase(null, 3)).toBe(0.15);
  });
});
