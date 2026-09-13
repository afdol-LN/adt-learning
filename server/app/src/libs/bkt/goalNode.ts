import { ConceptMapState, MasteryState } from './masteryState';

/**
 * The goal node at the bottom of every branch's skill tree (docs/adr/0005).
 * Derived on every read from the goal's required skills and this branch's
 * conceptMapState — never stored, so every branch has one from the moment it
 * is created, with no migration, backfill or branch-creation hook.
 * It is not a skill: no exercises, no P(L) of its own.
 */
export interface GoalNode {
  goalId: number;
  goalName: string;
  /** the goal's required skills — the tree draws an edge from each into the goal node */
  requiredSkillIds: number[];
  /** required skills with P(L) >= the mastery threshold, i.e. Progress 100% (docs/adr/0004) */
  masteredCount: number;
  requiredCount: number;
  isComplete: boolean;
}

/**
 * @param pL0BySkillId every skill that exists, with its pL0 — required skill ids missing
 *   from it (deleted skills) are ignored, since the tree has no node for them either.
 * @returns null when the goal requires no skills, so an empty tree stays empty.
 */
export function buildGoalNode(
  goal:
    | { id: number; goal: string; goalSkillRequire?: { skillId: number }[] }
    | null
    | undefined,
  conceptMapState: ConceptMapState | null | undefined,
  pL0BySkillId: Map<number, number>,
): GoalNode | null {
  if (!goal) return null;

  const requiredSkillIds = [
    ...new Set((goal.goalSkillRequire ?? []).map((r) => r.skillId)),
  ].filter((skillId) => pL0BySkillId.has(skillId));
  if (requiredSkillIds.length === 0) return null;

  // Same test that unlocks a skill: P(L) >= 0.95, which is Progress 100% (docs/adr/0004)
  const masteredCount = requiredSkillIds.filter(
    (skillId) =>
      MasteryState.getEntry(
        conceptMapState,
        skillId,
        pL0BySkillId.get(skillId)!,
      ).pL >= MasteryState.MASTERY_THRESHOLD,
  ).length;

  return {
    goalId: goal.id,
    goalName: goal.goal,
    requiredSkillIds,
    masteredCount,
    requiredCount: requiredSkillIds.length,
    isComplete: masteredCount === requiredSkillIds.length,
  };
}
