# 0001 — Students see Progress, not P(L)

- **Status:** accepted
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

The Exercise screen labelled its bar "P(L)" and showed `round(pL × 100)`. The skill-tree node for the same skill shows **Progress** — `min(100, round(pL / 0.95 × 100))` — or "ยังไม่เริ่ม" when the skill has no attempts yet. A student could open a skill that reads "not started" on the tree, see 25% on the exercise, and then "P(L): 40% → 55%" in the session popup: three renderings of one idea, one of them jargon.

## Decision

1. Every student-facing screen shows **Progress**, never raw P(L).
2. **The backend computes it.** `POST /session/start` and `POST /session/:id/answer` return `progress: { progressPercent, attemptCount }`, built by `MasteryState` — the same code that writes `conceptMapState` and that the skill tree reads through `getBranchSkills`. The frontend never re-implements the 0.95 threshold.
3. **Not started until the first answer.** On a skill with no attempts the Exercise bar shows "ยังไม่เริ่ม" and an empty bar, exactly like the node. It moves after the first answer, which is also when the backend writes the entry the node will show.
4. **The session popup shows Progress from session start to session end**, taken from the start response and the last answer response.

## Consequences

- Turning P(L) into a displayed number lives in two shared places only: `MasteryState.buildEntry` (the number, backend) and `displayProgressPercent` / `formatProgressLabel` (the "not started" rule, frontend). The skill tree and the Exercise screen both use them.
- `pL`, `summary.pLBefore` and `summary.pLAfter` stay in the API for logging and admin use. Note `summary.pLBefore` is the value before the **last** answer, not at session start — which is why the popup does not use it.
- Changing `MASTERY_THRESHOLD` changes every screen consistently, but stored `conceptMapState.progress` values are only recomputed when that skill is next answered.
