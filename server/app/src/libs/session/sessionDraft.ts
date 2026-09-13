/**
 * Practice-session drafts (docs/adr/0003). A draft is an unfinished session (`endedAt` null) of one
 * skill in one branch. When several are open — every visit to the Exercise page used to open one —
 * the newest session that already has answers wins, so an empty visit can never bury real work;
 * when none has answers, the newest open session is reused.
 */
export interface DraftCandidate {
  id: number;
  answeredCount: number;
}

export function pickDraft<T extends DraftCandidate>(open: T[]): T | null {
  const newestFirst = [...open].sort((a, b) => b.id - a.id);
  return newestFirst.find((s) => s.answeredCount > 0) ?? newestFirst[0] ?? null;
}
