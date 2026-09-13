# 0005 — Every skill tree ends in a goal node, derived on read

- **Status:** accepted
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

Every branch's skill tree should end in a "complete goal" node below its last skills, and that node should appear on its own whenever a branch is created. Nobody should have to add it by hand.

A branch's skill tree was never stored. `getBranchSkills` builds it on every read from the goal's required skills (`goalSkillRequire`) plus their prerequisites (`SkillGraph.getRelevantSkillIds`). We could store the node as a real row, either a `skill` per goal or something written when `POST /branch/mine` creates a branch. Either way, existing branches would need a migration and backfill. The row would also have to be filtered out of everything that treats skills as practisable: the pretest, question selection, BKT, next-skill recommendation, the exercise picker and the admin skill list.

## Decision

1. **The goal node is computed on every read of `GET /branch/:branchId/skills`** by `buildGoalNode` (`libs/bkt/goalNode.ts`). It is never stored, so there is no table, no migration and no branch-creation hook. Every branch, new or old, gets one.
2. **It is returned beside the skills, `{ skills, goal }`, never inside the skill array.** Nothing that walks the skills (unlocking, the exercise picker, starting an exercise, recommendations) can mistake it for a skill. `goal` is `null` when the goal requires no skills, so an empty tree stays empty.
3. **The goal is complete when every skill it requires has P(L) ≥ 0.95 in this branch**, which is Progress 100%. That is the same test that unlocks a skill ([0004](0004-progress-two-decimals-truncated.md)). Prerequisites that are not themselves required do not count. The backend does the counting (`masteredCount` / `requiredCount` / `isComplete`), and the frontend only draws the result. Required skill ids that no longer exist in `skill` are ignored, because the tree has no node for them either.
4. **Layout and interaction are frontend-only.** The node sits one row below the deepest skill, under the average x of the skills it requires, with an edge from each of them (`layoutGoalNode`). Clicking it opens `GoalSidePanel`, which shows the goal name, how many required skills are at 100%, and a list of those skills. It has no exercise button.

## Consequences

- The `/branch/:branchId/skills` response changed from an array to `{ skills, goal }`. The frontend service still reads the old array shape, as a tree without a goal node.
- Completing a goal is not recorded anywhere. If a required skill's P(L) later drops below 0.95, the goal reads incomplete again. A "completed on" date or a celebration would need a stored field, and that is a separate decision.
- The node shows a count ("2/3 skills"). The Home stat card "Goal progress" (`getBranchStats.goalProgressPercent`) shows the average Progress of the same required skills. Both are right, but they measure different things, so they will rarely show the same number.
- Pretest seeding can write a skill with `attemptCount = 0` and P(L) ≥ 0.95. That skill counts toward the goal, just as it already counts for unlocking, even though its node reads "not started".
- A required skill that is also a prerequisite of a deeper skill gets a long edge down to the goal row.
