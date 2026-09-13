# Glossary

Domain terms shared by the NestJS API (`server/app`), the KT engine (`server/btk-engine`) and the frontend (`../G06_adaptive_learning`). When code, UI copy or a doc uses one of these words, it means exactly this.

| Term | Meaning | Where it lives |
|---|---|---|
| **P(L)** (`pL`) | BKT probability that the student has learned a skill, 0–1. Internal model state — **never shown to students** (see [ADR 0001](adr/0001-students-see-progress-not-pl.md)). | `branch.conceptMapState[skillId].pL`, updated from `btk-engine` `POST /kt/attempt` |
| **pL0** | Prior P(L) for a skill that has no entry yet in this branch. | `skill.pL0` (0.25 in seed data) |
| **Mastery threshold** | P(L) at which a skill counts as mastered and a practice session stops: `0.95`. | `MasteryState.MASTERY_THRESHOLD` (`libs/bkt/masteryState.ts`) |
| **Progress** (`progress`, `progressPercent`) | What students see for a skill: P(L) scaled to the mastery threshold, `min(100, round(pL / 0.95 × 100))`. 100% = mastered. The ≥60% prerequisite unlock rule is measured in Progress. | `conceptMapState[skillId].progress`, written only by `MasteryState.buildEntry` |
| **Attempt count** | Practice questions answered for a skill in this branch. Pretest seeding writes entries with 0. | `conceptMapState[skillId].attemptCount` |
| **Not started** ("ยังไม่เริ่ม") | A skill with attempt count 0. Screens show this label and an empty bar instead of the pL0-derived percentage. | Frontend `formatProgressLabel` / `displayProgressPercent` (`component/home/utils/skillTree.ts`) |
| **Skill progress** (`SkillProgress`) | The pair `{ progressPercent, attemptCount }` — everything a screen needs to render progress. Returned by `getBranchSkills` (skill tree) and by `POST /session/start` / `POST /session/:id/answer` (Exercise). | `libs/bkt/masteryState.ts`; frontend `models/branchSkillModel.ts` |
| **Concept map state** | Per-branch JSON map `skillId → { pL, progress, status, attemptCount }`. Mastery is per branch, never per user. | `branch.conceptMapState` |
