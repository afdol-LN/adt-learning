export interface ConceptMapEntry {
  pL: number;
  progress: number;
  status: string;
  attemptCount: number;
}

export type ConceptMapState = Record<string, ConceptMapEntry>;

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
