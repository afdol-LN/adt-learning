import { buildGoalNode } from './goalNode';

describe('buildGoalNode', () => {
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
  const entry = (pL: number) => ({
    pL,
    progress: 0,
    status: 'unlocked',
    attemptCount: 1,
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
      isComplete: false,
    });
  });

  it('is complete when every required skill is mastered in this branch', () => {
    const node = buildGoalNode(
      goal,
      { '1': entry(0.97), '2': entry(0.96) },
      pL0,
    );
    expect(node?.isComplete).toBe(true);
  });

  it('falls back to pL0 for a required skill with no entry yet', () => {
    const node = buildGoalNode(goal, {}, new Map([...pL0, [2, 0.99]]));
    expect(node?.masteredCount).toBe(1); // skill 2's prior is already past the threshold
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
  });
});
