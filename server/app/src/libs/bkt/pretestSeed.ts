import { ConceptMapState, MasteryState } from './masteryState';
import { PretestMasteryCalculator, ProfileFactors } from './pretestMastery';
import { SkillTier } from './tier';

export interface SeedableGoalSkill {
  skillId: number;
  tier: string | null;
}

export class PretestSeeder {
  /**
   * Rebuilds the entries a pretest seeds for goal skills the student never
   * answered a question on. Those carry no `history` row, so the
   * history-driven backfill cannot see them at all — but the value is
   * deterministic (`computePL0` with empty stats), so it can be recomputed
   * exactly rather than recovered from a backup.
   *
   * Mirrors the unanswered-skill branch of `exerciseService.submitPretest`,
   * including its never-clobber rule: a skill that already has an entry keeps
   * whatever mastery it has.
   */
  static missingEntries(
    existingState: ConceptMapState | null,
    goalSkills: SeedableGoalSkill[],
    expForGoal: number | null,
    profile: ProfileFactors,
  ): ConceptMapState {
    const state = existingState ?? {};
    const additions: ConceptMapState = {};

    for (const skill of goalSkills) {
      if (state[String(skill.skillId)]) continue;
      const pL0 = PretestMasteryCalculator.computePL0(
        expForGoal,
        SkillTier.tierNum(skill.tier),
        [],
        profile,
      );
      additions[String(skill.skillId)] = MasteryState.buildEntry(pL0, 0);
    }

    return additions;
  }
}
