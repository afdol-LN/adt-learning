import { PretestDifficulty } from './pretestDifficulty';

const pool = [1, 1, 2, 3, 3, 4, 5].map((skillLevel, id) => ({
  id,
  skillLevel,
}));
const levels = (xs: { skillLevel: number }[]) =>
  [...new Set(xs.map((x) => x.skillLevel))].sort();

describe('PretestDifficulty.filterByExp', () => {
  it('keeps exp-1..exp+1', () => {
    expect(levels(PretestDifficulty.filterByExp(pool, 2))).toEqual([1, 2, 3]);
    expect(levels(PretestDifficulty.filterByExp(pool, 4))).toEqual([3, 4, 5]);
  });

  it('clamps at the edges', () => {
    expect(levels(PretestDifficulty.filterByExp(pool, 1))).toEqual([1, 2]);
    expect(levels(PretestDifficulty.filterByExp(pool, 5))).toEqual([4, 5]);
  });

  it('accepts exp sent as a string', () => {
    expect(levels(PretestDifficulty.filterByExp(pool, '2'))).toEqual([1, 2, 3]);
  });

  it('widens the range when nothing is in it', () => {
    const hardOnly = [4, 5].map((skillLevel) => ({ skillLevel }));
    expect(levels(PretestDifficulty.filterByExp(hardOnly, 1))).toEqual([4]);
  });

  it('returns everything when exp is missing', () => {
    expect(PretestDifficulty.filterByExp(pool, undefined)).toHaveLength(7);
    expect(PretestDifficulty.filterByExp(pool, null)).toHaveLength(7);
  });
});
