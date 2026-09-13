# 0005 — Every skill tree ends in a goal node, derived on read

- **Status:** accepted. Amended the same day: goal completion is recorded and sticks, and goal progress has a single computation (decisions 5–7).
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

Every branch's skill tree should end in a "complete goal" node below its last skills, and that node should appear on its own whenever a branch is created. Nobody should have to add it by hand.

A branch's skill tree was never stored. `getBranchSkills` builds it on every read from the goal's required skills (`goalSkillRequire`) plus their prerequisites (`SkillGraph.getRelevantSkillIds`). We could store the node as a real row, either a `skill` per goal or something written when `POST /branch/mine` creates a branch. Either way, existing branches would need a migration and backfill. The row would also have to be filtered out of everything that treats skills as practisable: the pretest, question selection, BKT, next-skill recommendation, the exercise picker and the admin skill list.

The first version of the node left two gaps:

- Completion was not recorded. A required skill whose P(L) fell back below 0.95 would silently un-complete the goal.
- The node's count ("2/3 skills") and the Home card "Goal progress" (`getBranchStats.goalProgressPercent`, an average of Progress) were computed in two places and rarely agreed. The card also averaged not-started skills at their pL0-derived Progress. So a fresh branch showed about 26% while every node in its tree read "not started".

## Decision

1. **The goal node is computed on every read of `GET /branch/:branchId/skills`** by `buildGoalNode` (`libs/bkt/goalNode.ts`). The node itself is never stored, so there is no table row and no branch-creation hook. Every branch, new or old, gets one.
2. **It is returned beside the skills, `{ skills, goal }`, never inside the skill array.** Nothing that walks the skills (unlocking, the exercise picker, starting an exercise, recommendations) can mistake it for a skill. `goal` is `null` when the goal requires no skills, so an empty tree stays empty.
3. **A goal is reached when every skill it requires has P(L) ≥ 0.95 in this branch**, which is Progress 100%. That is the same test that unlocks a skill ([0004](0004-progress-two-decimals-truncated.md)). Prerequisites that are not themselves required do not count. The backend does all the counting, and the frontend only draws the result. Required skill ids that no longer exist in `skill` are ignored.
4. **Layout and interaction are frontend-only.** The node sits one row below the deepest skill, under the average x of the skills it requires, with an edge from each of them (`layoutGoalNode`). Clicking it opens `GoalSidePanel`, which shows goal progress, the "x/y" count, and the required skills. It has no exercise button.
5. **Completion is recorded once and sticks.** `branch.goalCompletedAt` (nullable timestamp) is stamped the first time decision 3 holds. That can happen from `sessionService.submitAnswer` or from pretest seeding (`exerciseService`). From then on the goal is complete, its progress reads 100%, and the node shows the date, even if a required skill later drops below 0.95. Each skill's own node still shows its current Progress.
6. **Goal progress has one computation, `goalMastery`.** It is the average Progress of the required skills, 2 decimals and truncated. A not-started skill (`attemptCount = 0`) counts 0, as every screen already shows it, unless its P(L) is ≥ 0.95, which counts 100 as it does for unlocking. `buildGoalNode` and `getBranchStats` both call it. The node and the Home card show the same percentage as the headline, with "x/y skills" as the secondary figure.
7. **The celebration is on the session summary.** The answer that completes the goal is always the one that masters the last required skill, so it always ends its session as `mastered`. `submitAnswer` returns `summary.goalCompleted = { goalId, goalName }` only for that answer. The summary shows a "Goal complete" badge and a "View skill tree" button in place of the next-skill suggestion.

## Consequences

- The `/branch/:branchId/skills` response changed from an array to `{ skills, goal }`. The frontend service still reads the old array shape, as a tree without a goal node. However, an old frontend against the new backend breaks, so deploy the frontend first or together with the backend.
- Migration `AddGoalCompletedAtToBranch1789300000000` adds the column. There is no backfill. A branch that was already complete before the column existed reads complete immediately, because decision 3 still holds. It gets its date at its next answer, which is later than the real completion, and it gets no celebration.
- Completing a goal through the pretest records the date but shows no celebration, because no session summary exists for it.
- The Home card now reads 0% on a fresh branch instead of about 26%, and it may jump when the first answer on a skill is recorded.
- A required skill that is also a prerequisite of a deeper skill gets a long edge down to the goal row.
