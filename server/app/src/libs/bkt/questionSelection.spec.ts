import { CandidateExercise, QuestionSelector } from './questionSelection';

const ex = (
  id: number,
  skillLevel: number,
  pG = 0.25,
  pS = 0.1,
): CandidateExercise => ({ id, skillLevel, pG, pS });

const oneOfEachLevel = [ex(1, 1), ex(2, 2), ex(3, 3), ex(4, 4), ex(5, 5)];

describe('QuestionSelector.targetLevel', () => {
  it.each([
    [0, 1],
    [0.18, 1], // Progress 18.94
    [0.19, 2], // Progress 20
    [0.2, 2],
    [0.38, 3], // Progress 40
    [0.5, 3],
    [0.6, 4], // Progress 63.15
    [0.76, 5], // Progress 80
    [0.9, 5],
    [0.95, 5],
    [1, 5],
  ])('pL %p -> level %p', (pL, level) => {
    expect(QuestionSelector.targetLevel(pL)).toBe(level);
  });
});

describe('QuestionSelector.selectNext', () => {
  it('returns null when there are no candidates', () => {
    expect(QuestionSelector.selectNext([], 0.5)).toBeNull();
  });

  it.each([
    [0.2, 2],
    [0.5, 3],
    [0.6, 4],
    [0.8, 5],
    [0.9, 5],
  ])('picks the level of the band pL %p falls in (level %p)', (pL, id) => {
    expect(QuestionSelector.selectNext(oneOfEachLevel, pL)).toBe(id);
  });

  it('falls back to the nearest level when the band has no question', () => {
    // pL 0.6 -> level 4; only 1, 2 and 5 left
    expect(
      QuestionSelector.selectNext([ex(1, 1), ex(2, 2), ex(5, 5)], 0.6),
    ).toBe(5);
  });

  it('prefers the easier level when two are equally near', () => {
    // pL 0.5 -> level 3; 2 and 4 are both one away
    expect(QuestionSelector.selectNext([ex(4, 4), ex(2, 2)], 0.5)).toBe(2);
  });

  it('within a level, picks the item whose predicted correctness is nearest 0.7', () => {
    // pL 0.5, level 3: predicted = 0.5*(1-pS) + 0.5*pG
    const far = ex(1, 3, 0.05, 0.3); // 0.375
    const near = ex(2, 3, 0.5, 0.1); // 0.7
    expect(QuestionSelector.selectNext([far, near], 0.5)).toBe(2);
  });

  it('breaks a full tie on the lowest id, so a resumed draft gets the same question', () => {
    expect(QuestionSelector.selectNext([ex(9, 3), ex(7, 3)], 0.5)).toBe(7);
    expect(QuestionSelector.selectNext([ex(7, 3), ex(9, 3)], 0.5)).toBe(7);
  });

  it('treats a level outside 1-5 as the default level 3', () => {
    expect(QuestionSelector.selectNext([ex(1, 1), ex(2, 0)], 0.5)).toBe(2);
  });
});
