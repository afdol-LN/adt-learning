# 0004 — Progress keeps 2 decimals and is never rounded up

- **Status:** accepted. Amends the Progress formula in [0001](0001-students-see-progress-not-pl.md).
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

Progress was `min(100, round(pL / 0.95 × 100))`. Because of the rounding it read **100%** from P(L) ≈ 0.9453, while everything that means "mastered" checks `pL >= 0.95`: the session stopping as `mastered`, the next-skill recommendation, and `getBranchStats`. In that gap the Skill Tree, which unlocks at Progress `=== 100`, showed the skill as done and unlocked the skills after it, while the backend still treated it as unmastered and kept the session going.

The docs also said a skill unlocks at ≥60%, which no code ever implemented.

## Decision

1. **Progress = P(L) / 0.95 × 100, capped at 100, kept to 2 decimals and truncated. It is never rounded up.** `MasteryState.progressOf` is the only implementation. A `1e-9` guard absorbs binary floating-point noise (`0.57 / 0.95 × 100` evaluates to 59.999…). It is far below 0.01 and never lifts a real value to the next hundredth.
2. **So Progress = 100% exactly when P(L) ≥ 0.95.** A skill unlocks the skills after it when every prerequisite has P(L) ≥ 0.95, which is the same thing as Progress = 100%. The frontend check (`=== 100`) and the backend checks (`pL >= 0.95`) now agree by construction.
3. **Progress is re-derived from P(L) on every read** (`MasteryState.getEntry`). The stored `conceptMapState.progress` is only a cache, so entries written under the old rounded formula are corrected without a backfill.
4. **Anything averaged from Progress is truncated the same way.** Today that is the goal progress on Home (`getBranchStats.goalProgressPercent`).

## Consequences

- Screens show values such as 52.63% instead of 53%.
- Numbers that are not skill mastery still use `Math.round`, because they are not Progress: the pretest step percentage, the session accuracy score and the behaviour scores.
- Until a skill is answered again, its stored `conceptMapState.progress` in the database can differ from what screens show. Nothing in the app reads it directly; everything goes through `getEntry`. Anything that reads it raw, such as SQL or reports, must recompute it from `pL`.
