export class SkillTier {
  static readonly DEFAULT_TIER_NUM = 3;

  static tierNum(tier?: string | null): number {
    if (!tier) return this.DEFAULT_TIER_NUM;
    const parsed = parseInt(tier.replace('T', ''), 10);
    return Number.isNaN(parsed) ? this.DEFAULT_TIER_NUM : parsed;
  }
}
