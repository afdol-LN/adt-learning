import { PretestSeeder } from './pretestSeed';
import { PretestMasteryCalculator } from './pretestMastery';
import { MasteryState } from './masteryState';

describe('PretestSeeder.missingEntries', () => {
  const profile = { isAboutCs: false, year: 1 };
  const goalSkills = [
    { skillId: 1, tier: 'T1' },
    { skillId: 2, tier: 'T2' },
  ];

  it('seeds a goal skill that has no entry yet, using the empty-stats pL0', () => {
    const additions = PretestSeeder.missingEntries({}, goalSkills, 3, profile);

    const expectedPL1 = PretestMasteryCalculator.computePL0(3, 1, [], profile);
    expect(additions['1']).toEqual(MasteryState.buildEntry(expectedPL1, 0));
    expect(additions['1'].attemptCount).toBe(0);
    expect(Object.keys(additions).sort()).toEqual(['1', '2']);
  });

  it('never overwrites a skill that already has an entry', () => {
    const existing = {
      '1': { pL: 0.9, progress: 95, status: 'unlocked', attemptCount: 7 },
    };

    const additions = PretestSeeder.missingEntries(
      existing,
      goalSkills,
      3,
      profile,
    );

    expect(additions['1']).toBeUndefined();
    expect(Object.keys(additions)).toEqual(['2']);
  });

  it('treats a null state as empty', () => {
    const additions = PretestSeeder.missingEntries(null, goalSkills, 3, profile);
    expect(Object.keys(additions).sort()).toEqual(['1', '2']);
  });

  it('returns nothing when every goal skill is already present', () => {
    const existing = {
      '1': { pL: 0.3, progress: 32, status: 'unlocked', attemptCount: 1 },
      '2': { pL: 0.4, progress: 42, status: 'unlocked', attemptCount: 2 },
    };

    expect(
      PretestSeeder.missingEntries(existing, goalSkills, 3, profile),
    ).toEqual({});
  });

  it('scales the seeded pL with the branch experience level', () => {
    const low = PretestSeeder.missingEntries({}, goalSkills, 1, profile);
    const high = PretestSeeder.missingEntries({}, goalSkills, 5, profile);
    expect(high['2'].pL).toBeGreaterThan(low['2'].pL);
  });
});
