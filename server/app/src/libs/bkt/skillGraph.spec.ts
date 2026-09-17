import { SkillGraph, SkillWithPrerequisites } from './skillGraph';

// helper: each row is [skillId, ...prerequisiteIds]
const graph = (...rows: number[][]): SkillWithPrerequisites[] =>
  rows.map(([skillId, ...prereqs]) => ({
    skillId,
    skillPrequisite: prereqs.map((prerequisiteSkillId) => ({ prerequisiteSkillId })),
  }));

describe('SkillGraph.wouldCreateCycle', () => {
  it('flags a skill listed as its own prerequisite', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2]), 1, [1])).toBe(true);
  });

  it('flags a two-step cycle (1 -> 2 -> 1)', () => {
    // skill 2 already requires skill 1; making 2 a prerequisite of 1 closes the loop
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1]), 1, [2])).toBe(true);
  });

  it('flags a three-step cycle (1 -> 2 -> 3 -> 1)', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1], [3, 2]), 1, [3])).toBe(true);
  });

  it('allows a diamond, which is a DAG and not a cycle', () => {
    // 4 requires 2 and 3; both require 1. Adding 1 directly is still acyclic.
    expect(
      SkillGraph.wouldCreateCycle(graph([1], [2, 1], [3, 1], [4, 2, 3]), 4, [2, 3, 1]),
    ).toBe(false);
  });

  it('allows an empty prerequisite list', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1]), 2, [])).toBe(false);
  });

  it('ignores prerequisite ids that are not in the graph', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1]), 1, [99])).toBe(false);
  });
});
