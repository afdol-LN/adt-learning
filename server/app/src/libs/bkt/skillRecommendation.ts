import { SkillTier } from './tier';

export interface EligibleSkillCandidate {
  skillId: number;
  tier?: string | null;
  pL: number;
}

export class SkillRecommender {
  static readonly MASTERY_THRESHOLD = 0.95;

  static rank(
    candidates: EligibleSkillCandidate[],
  ): EligibleSkillCandidate | null {
    const eligible = candidates.filter((c) => c.pL < this.MASTERY_THRESHOLD);
    if (eligible.length === 0) return null;

    return [...eligible].sort((a, b) => {
      const tierDiff = SkillTier.tierNum(a.tier) - SkillTier.tierNum(b.tier);
      if (tierDiff !== 0) return tierDiff;
      const plDiff = a.pL - b.pL;
      if (plDiff !== 0) return plDiff;
      return a.skillId - b.skillId;
    })[0];
  }
}
