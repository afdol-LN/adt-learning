# To-Do — Goal Admin Panel

From the code review of the Goal admin panel (`adt-learning` + `G06_adaptive_learning`), 2026-08-01.

## Priority 1 — Urgent: Critical Fixes

- [x] **Duplicate `skillId` in `skillRequires` causes an unhandled 500.**
  `adt-learning/server/app/src/service/goal.service.ts:130-143`
  `GoalSkillRequire` has a composite PK `(goalId, skillId)`. A request with two entries for the same skill (bypassing the frontend's client-side `usedIds` filter — e.g. a raw API call) hits an unhandled Postgres unique-violation inside the transaction, surfacing as a generic 500 instead of a clean 400. Add an explicit duplicate check in `validateSkillRequires` (or before it) that throws `BadRequestException` on a repeated `skillId`.

- [ ] **No authentication on `/goal` mutating routes — needs a conscious decision.**
  `adt-learning/server/app/src/app.module.ts` (repo-wide: `AuthMiddleWare` is commented out)
  All five `/goal` routes — including create, update, and soft-delete — are reachable with no token. Pre-existing/documented repo-wide issue, not introduced by this feature, but this is the first branch to add real mutating endpoints onto that surface. Decide explicitly before merging broadly: re-enable `AuthMiddleWare` for `/goal`, or accept the risk and document why.

## Priority 2 — Non-functional: Suggestions

- [ ] **`findAll()` over-fetches for the list view.**
  `adt-learning/server/app/src/service/goal.service.ts:30-31`
  `GET /goal` eager-loads the full 3-level nested relation (`goalSkillRequire → skill → skillPrequisite → prerequisiteSkill`) for every goal, but the list view only renders skill names as tags — the deep join is only needed for the single-goal learning-tree view. Consider a lighter relation set for `findAll()`, reserving the full nested load for `findOne()`.

- [ ] **N+1 query in `validateSkillRequires`.**
  `adt-learning/server/app/src/service/goal.service.ts:130-144`
  One `skillRepo.findOne(...)` per array entry in a sequential loop. Replace with a single `skillRepo.find({ where: { skillId: In(ids) } })` plus a `Set` lookup. (`skillService.validatePrerequisites` has the identical pre-existing pattern — worth fixing both if you touch either.)

- [ ] **No server-side bounds check on `levelRequire`.**
  `adt-learning/server/app/src/dto/goal.dto.ts` (`GoalSkillRequireItemDto`) / `goal.service.ts` `validateSkillRequires`
  The frontend now caps level to 1-6 via the Bloom's Taxonomy dropdown (`G06_adaptive_learning/src/component/adminHome/goalPanel/component/SkillRequireEditor.tsx:13-20`), but nothing enforces that server-side. A direct API call can still write `levelRequire: -5` or `9999`. Add a min/max check in `validateSkillRequires`, matching the existing manual-validation style already used for the required-name check.

- [ ] **Status toggle blanks the whole table, not just the row.**
  `G06_adaptive_learning/src/component/adminHome/goalPanel/goal.controller.ts` (`toggleGoalStatus`)
  Reuses the shared `isLoading` flag, so clicking "ระงับ"/"เปิด" on one row shows a full-table loading state for the round-trip. Use a per-row pending flag instead, or drop the flag since the update is a small, fast call.

- [ ] **`GoalLearningTree` re-runs dagre layout on every render.**
  `G06_adaptive_learning/src/component/adminHome/goalPanel/component/GoalLearningTree.tsx`
  Fine at current goal sizes; wrap `layoutTree(requires)` in `useMemo` if goals grow to dozens of required skills.

- [ ] **Unrelated WIP got bundled into feature commits.**
  `G06_adaptive_learning` (`d64b473 "admin goal"`) and `adt-learning` (`947b7ce "1-8-69"`)
  Both commits mix this feature's files with a large amount of pre-existing unrelated work and a repo-wide Prettier reformat. Not a code defect, but worth separating out before opening a PR so reviewers aren't asked to review 40+ unrelated files.
