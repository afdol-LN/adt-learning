export interface ConceptMapEntry {
  pL: number;
  progress: number;
  status: string;
  attemptCount: number;
}

export type ConceptMapState = Record<string, ConceptMapEntry>;

/**
 * What a student sees for a skill — the skill-tree node, the Exercise progress
 * bar and the session popup all render this pair (docs/adr/0001). The frontend
 * shows "not started" when attemptCount is 0, otherwise progressPercent.
 */
export interface SkillProgress {
  progressPercent: number;
  attemptCount: number;
}

/**
 * Keep 2 decimals and drop the rest — never round up (docs/adr/0004).
 * The 1e-9 only absorbs binary floating-point noise (0.57 / 0.95 × 100 evaluates to 59.999…);
 * it is far below 0.01 and never lifts a real value to the next hundredth.
 */
export function truncate2(value: number): number {
  return Math.floor(value * 100 + 1e-9) / 100;
}

export class MasteryState {
  static readonly MASTERY_THRESHOLD = 0.95;

  /**
   * Progress (what students see): pL scaled to the mastery threshold, capped at 100, 2 decimals,
   * truncated — never rounded up. So it reads 100 exactly when pL >= MASTERY_THRESHOLD, which is
   * also when a skill unlocks its dependents (docs/adr/0004). The only place this is computed.
   */
  static progressOf(pL: number): number {
    return truncate2(Math.min(100, (pL / this.MASTERY_THRESHOLD) * 100));
  }

  static buildEntry(pL: number, attemptCount: number): ConceptMapEntry {
    return {
      pL,
      progress: this.progressOf(pL),
      status: pL >= this.MASTERY_THRESHOLD ? 'completed' : 'unlocked',
      attemptCount,
    };
  }

  static toProgress(entry: ConceptMapEntry): SkillProgress {
    return {
      progressPercent: entry.progress,
      attemptCount: entry.attemptCount,
    };
  }

  static getEntry(
    conceptMapState: ConceptMapState | null | undefined,
    skillId: number,
    fallbackPL0: number,
  ): ConceptMapEntry {
    const existing = conceptMapState?.[String(skillId)];
    // Progress is re-derived from pL on every read: the stored value is only a cache, so entries
    // written under the old rounded formula never reach a screen (docs/adr/0004)
    if (existing) return { ...existing, progress: this.progressOf(existing.pL) };
    return this.buildEntry(fallbackPL0, 0);
  }
}
