import { buildGoalNode, goalMastery } from './goalNode';

describe('goalMastery / buildGoalNode', () => {
  const goal = {
    id: 3,
    goal: 'Backend Developer',
    goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }],
  };
  const pL0 = new Map([
    [1, 0.25],
    [2, 0.25],
    [3, 0.25],
  ]);
  const entry = (pL: number, attemptCount = 1) => ({
    pL,
    progress: 0,
    status: 'unlocked',
    attemptCount,
  });

  it('counts a required skill as mastered exactly from P(L) 0.95 (Progress 100%)', () => {
    const node = buildGoalNode(
      goal,
      { '1': entry(0.95), '2': entry(0.9499) },
      pL0,
    );
    expect(node).toEqual({
      goalId: 3,
      goalName: 'Backend Developer',
      requiredSkillIds: [1, 2],
      masteredCount: 1,
      requiredCount: 2,
      progressPercent: 99.99, // (100 + 99.98) / 2, truncated — never reads 100 before it is
      isComplete: false,
      completedAt: null,
    });
  });

  it('averages the Progress of the required skills, counting a not-started skill as 0', () => {
    const m = goalMastery([1, 2], { '1': entry(0.5) }, pL0);
    // skill 1: 0.5 → 52.63; skill 2 has no entry — not started, so 0, not its pL0-derived 26.31
    expect(m.progressPercent).toBe(26.31);
    expect(goalMastery([1, 2], {}, pL0).progressPercent).toBe(0);
  });

  it('counts a not-started skill already at P(L) >= 0.95 (a pretest seed) as mastered', () => {
    const m = goalMastery([1], { '1': entry(0.97, 0) }, pL0);
    expect(m).toMatchObject({ masteredCount: 1, progressPercent: 100, allMastered: true });
  });

  it('is complete when every required skill is mastered in this branch', () => {
    const node = buildGoalNode(
      goal,
      { '1': entry(0.97), '2': entry(0.96) },
      pL0,
    );
    expect(node).toMatchObject({ isComplete: true, progressPercent: 100 });
  });

  it('stays complete once recorded, even after a required skill drops below 0.95', () => {
    const node = buildGoalNode(
      goal,
      { '1': entry(0.97), '2': entry(0.9) },
      pL0,
      new Date('2026-09-10T08:00:00Z'),
    );
    expect(node).toMatchObject({
      isComplete: true,
      progressPercent: 100,
      masteredCount: 1, // the live count is still reported
      completedAt: '2026-09-10T08:00:00.000Z',
    });
  });

  it('only counts required skills — a mastered prerequisite that is not required does not help', () => {
    const node = buildGoalNode(goal, { '3': entry(0.99) }, pL0);
    expect(node?.masteredCount).toBe(0);
  });

  it('ignores required skill ids that no longer exist, and duplicate requirement rows', () => {
    const node = buildGoalNode(
      {
        ...goal,
        goalSkillRequire: [{ skillId: 1 }, { skillId: 1 }, { skillId: 99 }],
      },
      { '1': entry(0.96) },
      pL0,
    );
    expect(node?.requiredSkillIds).toEqual([1]);
    expect(node?.isComplete).toBe(true);
  });

  it('is null when the goal requires no skills, so an empty tree stays empty', () => {
    expect(buildGoalNode({ ...goal, goalSkillRequire: [] }, {}, pL0)).toBeNull();
    expect(buildGoalNode(null, {}, pL0)).toBeNull();
    expect(goalMastery([], {}, pL0)).toMatchObject({ allMastered: false, progressPercent: 0 });
  });
});
