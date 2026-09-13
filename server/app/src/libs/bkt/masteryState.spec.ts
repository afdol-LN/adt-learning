import { MasteryState, truncate2 } from './masteryState';

// docs/adr/0004: Progress keeps 2 decimals and is never rounded up
describe('MasteryState.progressOf', () => {
  it('keeps 2 decimals and never rounds up', () => {
    expect(MasteryState.progressOf(0.6)).toBe(63.15); // 63.157…
    expect(MasteryState.progressOf(0.9499)).toBe(99.98); // 99.989…
  });

  it('reads 100 exactly when pL reaches the mastery threshold', () => {
    expect(MasteryState.progressOf(0.9453)).toBe(99.5); // read 100 when rounded
    expect(MasteryState.progressOf(0.95)).toBe(100);
    expect(MasteryState.progressOf(0.99)).toBe(100);
  });

  it('is not pushed down by floating-point noise', () => {
    expect(MasteryState.progressOf(0.57)).toBe(60); // 0.57 / 0.95 × 100 evaluates to 59.999…
  });
});

describe('MasteryState.getEntry', () => {
  it('re-derives progress stored under the old rounded formula', () => {
    const entry = MasteryState.getEntry(
      { '1': { pL: 0.946, progress: 100, status: 'unlocked', attemptCount: 4 } },
      1,
      0.25,
    );
    expect(entry.progress).toBe(99.57);
    expect(entry.attemptCount).toBe(4);
  });
});

describe('truncate2', () => {
  it('drops everything after the second decimal', () => {
    expect(truncate2(26.3157)).toBe(26.31);
    expect(truncate2(99.999)).toBe(99.99);
    expect(truncate2(100)).toBe(100);
  });
});
