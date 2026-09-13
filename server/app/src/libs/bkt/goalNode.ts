import { ConceptMapState, MasteryState, truncate2 } from './masteryState';

/** How far one branch is through its goal's required skills, right now (docs/adr/0005). */
export interface GoalMastery {
  /** the goal's required skills that exist, without duplicates */
  requiredSkillIds: number[];
  /** required skills with P(L) >= the mastery threshold, i.e. Progress 100% (docs/adr/0004) */
  masteredCount: number;
  requiredCount: number;
  /**
   * Goal progress: average Progress of the required skills, 2 decimals, truncated.
   * A not-started skill (attemptCount 0) counts 0 — as every screen shows it — unless its
   * P(L) is already >= 0.95, which counts 100, as it does for unlocking.
   */
  progressPercent: number;
  allMastered: boolean;
}

/**
 * The goal node at the bottom of every branch's skill tree (docs/adr/0005).
 * Derived on every read from the goal's required skills, this branch's conceptMapState
 * and branch.goalCompletedAt — so every branch has one from the moment it is created.
 * It is not a skill: no exercises, no P(L) of its own.
 */
export interface GoalNode {
  goalId: number;
  goalName: string;
  /** the tree draws an edge from each of these skills into the goal node */
  requiredSkillIds: number[];
  masteredCount: number;
  requiredCount: number;
  /** goal progress (see GoalMastery); 100 once the goal is complete */
  progressPercent: number;
  /** sticky: true from the first time every required skill was mastered, even if one dropped since */
  isComplete: boolean;
  /** ISO time the goal was first completed; null if not yet, or completed before it was recorded */
  completedAt: string | null;
}

/**
 * The one implementation of goal progress — the goal node and the Home "Goal progress" card
 * (getBranchStats) both read it, so they always agree.
 * @param pL0BySkillId every skill that exists, with its pL0 — required skill ids missing
 *   from it (deleted skills) are ignored, since the tree has no node for them either.
 */
export function goalMastery(
  goalSkillIds: number[],
  conceptMapState: ConceptMapState | null | undefined,
  pL0BySkillId: Map<number, number>,
): GoalMastery {
  const requiredSkillIds = [...new Set(goalSkillIds)].filter((skillId) =>
    pL0BySkillId.has(skillId),
  );

  let masteredCount = 0;
  let progressSum = 0;
  for (const skillId of requiredSkillIds) {
    const entry = MasteryState.getEntry(
      conceptMapState,
      skillId,
      pL0BySkillId.get(skillId)!,
    );
    // Same test that unlocks a skill: P(L) >= 0.95, which is Progress 100% (docs/adr/0004)
    if (entry.pL >= MasteryState.MASTERY_THRESHOLD) {
      masteredCount++;
      progressSum += 100;
    } else if (entry.attemptCount > 0) {
      progressSum += entry.progress;
    }
    // else not started: counts 0, never its pL0-derived percentage (glossary: Not started)
  }

  const requiredCount = requiredSkillIds.length;
  return {
    requiredSkillIds,
    masteredCount,
    requiredCount,
    progressPercent:
      requiredCount > 0 ? truncate2(progressSum / requiredCount) : 0,
    allMastered: requiredCount > 0 && masteredCount === requiredCount,
  };
}

/**
 * @param completedAt branch.goalCompletedAt — once set, the goal stays complete.
 * @returns null when the goal requires no skills, so an empty tree stays empty.
 */
export function buildGoalNode(
  goal:
    | { id: number; goal: string; goalSkillRequire?: { skillId: number }[] }
    | null
    | undefined,
  conceptMapState: ConceptMapState | null | undefined,
  pL0BySkillId: Map<number, number>,
  completedAt?: Date | null,
): GoalNode | null {
  if (!goal) return null;

  const mastery = goalMastery(
    (goal.goalSkillRequire ?? []).map((r) => r.skillId),
    conceptMapState,
    pL0BySkillId,
  );
  if (mastery.requiredCount === 0) return null;

  // A recorded completion sticks: a required skill dropping below 0.95 later does not undo it
  const isComplete = !!completedAt || mastery.allMastered;

  return {
    goalId: goal.id,
    goalName: goal.goal,
    requiredSkillIds: mastery.requiredSkillIds,
    masteredCount: mastery.masteredCount,
    requiredCount: mastery.requiredCount,
    progressPercent: isComplete ? 100 : mastery.progressPercent,
    isComplete,
    completedAt: completedAt ? completedAt.toISOString() : null,
  };
}
