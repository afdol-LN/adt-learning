# 0006 — Pretest starts every skill well below mastery

- **Status:** accepted. Changes the constants of `PretestMasteryCalculator` (`libs/bkt/pretestMastery.ts`); the formula shape is unchanged.
- **Date:** 2026-09-23
- **Terms:** see [glossary](../glossary.md)

## Context

After the pretest, each goal skill is seeded with `pL0 = min(cap, base + pretest + profile)`:

| Part | Comes from | Old max |
|---|---|---|
| base | `expForGoal` — **typed in by the student** — against the skill tier | 0.75 (exp 5 on a T1 skill) |
| pretest | accuracy × 0.1 + speed × 0.05 on that skill's pretest questions | 0.15 |
| profile | CS major +0.05, year ≥ 2 +0.04 | 0.09 |
| cap | `PL0_CAP` | 0.85 |

Students finished goals too fast. Two things caused it:

1. **The self-reported experience outweighed the pretest.** With exp 5 on a T1 skill, an all-right pretest gave 0.85 (capped) and an all-wrong one gave 0.84. The answers barely mattered.
2. **A high start is one correct answer from mastered.** Simulating the `btk-engine` update (`posterior_given_evidence` + `apply_learning_transition`, pT 0.1, answered in time) for the correct answers in a row needed to reach P(L) ≥ 0.95:

   | pL0 | level 1 (pS .05, pG .25) | level 3 (pS .10, pG .20) | level 5 (pS .18, pG .15) |
   |---|---|---|---|
   | 0.10 | 4 | 4 | 3 |
   | 0.25 | 3 | 3 | 3 |
   | 0.55 | 2 | 2 | 2 |
   | 0.85 | **1** | **1** | **1** |

## Decision

1. **Base from experience is at most 0.35.** By gap (exp − tier): ≤ −2 → 0.10, −1 → 0.12, 0 → 0.15, +1 → 0.20, +2 → 0.25, +3 → 0.30, ≥ +4 → 0.35.
2. **Profile is at most 0.05:** CS major +0.03, year ≥ 2 +0.02.
3. **The pretest share stays at 0.15.** It is the only part backed by answers, so it now carries more weight relative to the rest.
4. **`PL0_CAP` is 0.6 and is a safety net only.** The parts add up to 0.55 at most, so nothing reaches it today; it stops a later change to one constant from seeding a skill close to mastered.

The strongest possible start (0.55) now needs two correct answers to master a skill, and an all-right pretest starts 0.15 above an all-wrong one.

## Consequences

- **Only new pretests use these numbers.** Seeding never overwrites an existing `conceptMapState` entry, so branches that did the pretest before this change keep their old, higher starting P(L). No backfill was run.
- **The starting-score breakdown screen (`getPretestBreakdown`) disagrees with the skill tree for those older branches.** It recomputes from the current constants on every read instead of storing what was seeded, so it shows the new, lower numbers while the tree shows the old seeded P(L). This was accepted rather than adding a formula-version column or a backfill; revisit it if students ask about the mismatch.
- `PretestSeeder.missingEntries` (the history backfill for unanswered pretest skills) also uses the current constants, so rerunning that backfill on an old branch would seed missing skills with the new values.
- This does not stop a student from answering two questions and moving on. A minimum number of practice answers before a skill counts as mastered was discussed as the more direct control and needs its own ADR, because it changes what Progress means ([0001](0001-students-see-progress-not-pl.md), [0004](0004-progress-two-decimals-truncated.md)).
- The pretest is still graded by the client, which sends `isCorrect`; giving the pretest more weight makes moving that grading to the server more pressing.
