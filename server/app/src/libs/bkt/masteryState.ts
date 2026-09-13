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

export class MasteryState {
  static readonly MASTERY_THRESHOLD = 0.95;

  static buildEntry(pL: number, attemptCount: number): ConceptMapEntry {
    const progress = Math.min(
      100,
      Math.round((pL / this.MASTERY_THRESHOLD) * 100),
    );
    return {
      pL,
      progress,
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
    if (existing) return existing;
    return this.buildEntry(fallbackPL0, 0);
  }
}
