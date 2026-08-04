# Plan: Student Home Page — Mock Data → Real Backend Data

## Context

The student-facing "Home" page (`G06_adaptive_learning/src/component/Home.tsx`, 1089 lines) is currently 100% driven by two mock data files (`src/component/mockData.js`, `src/data/mockData.js`). Everything — skills, progress, sessions, streak, goal progress, behavior classification — is hardcoded or client-computed from fake arrays. The user wants this converted to real data from the NestJS/Postgres backend, using the existing "controller + hook" pattern already established in `adminHome/*` panels, with `Home.tsx` split into one component per tab plus genuinely reusable shared components.

**Locked scope decisions (from the user):**
- Remove the Elo/Level concept entirely (`getSkillElo`, `getSkillLevel`, `ELO_RANGES`, per-branch `xp`/`level`). Do **not** enable the BKT/`kt` engine this round — `kt.controller.ts`/`kt.service.ts`/`HttpModule` stay commented out in `app.module.ts`. That's explicitly deferred (see §7).
- All 4 tabs (Home, SkillTree, History, Profile) get real data in this round.
- `Home.tsx` splits into one component per tab, plus extraction of genuinely reusable pieces into `src/component/common/`.
- Data fetching uses the dominant existing "controller + hook" pattern (service returns `ApiResponse<T>`, a hook-shaped controller wraps it with `useState`/`useEffect`, consumed by the component) — see `src/component/adminHome/skillPanel/skill.service.ts` + `skill.controller.ts`.

## Current state (verified)

- `computeBehavior()` (Mastery/Fast/Steady/Slow/Struggler classification) is derived from `sessions[].questions[].{time,correct}` — **not** from Elo — so it can be kept and fed real data.
- Mock files are referenced **only** from `Home.tsx` (confirmed via grep) — safe to delete once replaced.
- `App.tsx` imports the same `Home.tsx` default export twice under two names (`Home` for `/home`, `HomeNew` for `/homenew`) — pre-existing quirk, not something to fix beyond repointing both imports.
- Backend has real endpoints for skills/goals/branches (`GET /branch/mine`, `skillController`, `goalController`) but **no** endpoint for per-student aggregated dashboard data (progress, streak, session history). `History` entity exists but isn't registered in `TypeOrmModule.forFeature`, and there's no `history.controller.ts`/`history.service.ts` at all.
- `History` has no field for what the student picked (`chosenAnswer`) — needed for the History tab's per-question detail.
- Prerequisite unlock rule: docs say ≥60% progress, but since BKT is not enabled yet (the real future threshold will be `pL >= 0.95` once the engine is live — see §7), the rule for this round is tightened to **100% progress** on **all** parent prerequisites (`skills_prerequisite`) — i.e. a prerequisite must be fully correct/complete, not just mostly, before it unlocks children.
- `userProfileService.fillAllForAdminManage()` (`adt-learning/server/app/src/service/user.service.ts`) is the best existing template for the streak/session-count/correct% aggregation logic — it's admin-wide; the new work needs a per-branch, per-skill-breakdown version of the same idea.

## 1. Backend (`adt-learning/server/app`)

### 1.1 Register `History` entity
`src/app.module.ts` — import `History` from `./entity/history.entity.ts`, add to `TypeOrmModule.forFeature([...])`.

### 1.2 Schema addition: `chosenAnswer`
`History` has `isCorrect` but not what was picked. Additive, nullable change:
- `src/entity/history.entity.ts` — add `@Column({ nullable: true }) chosenAnswer: string | null;`
- Generate + run migration (`npm run migration:generate`, `npm run migration:run`) — schema changes must go through migrations (`synchronize: false`).
- `src/dto/exerciseAndSession/pretestSubmit.dto.ts` — add optional `chosenAnswer?: string` to the answer DTO.
- `src/service/exercise.service.ts` (`submitPretest`) — persist `chosenAnswer` on the created `History` row.
- `submitPretest` is currently the **only** write path into `History` — real session data will only reflect pretest attempts until a general exercise-submission endpoint exists. Not this task's problem to fix, but bounds what test data will exist.
- Frontend: `src/component/pretest/controller/usePretestController.ts` needs to start sending `chosenAnswer` in its submit payload so new rows actually carry it — small necessary side-change outside `Home.tsx`'s blast radius, call it out explicitly when implementing.

### 1.3 New/changed endpoints

| Endpoint | Home | Returns | Notes |
|---|---|---|---|
| `GET /branch/:branchId/skills` | `branchController` (new route) | all skills w/ `progressPercent` + prerequisite relation | ownership-checked against `req.user` |
| `GET /branch/:branchId/stats` | `branchController` (new route) | `{ skillsUnlockedCount, sessionsCount, dayStreak, goalProgressPercent }` | single dashboard-stats call for Home tab |
| `GET /history/branch/:branchId/sessions` | **new** `historyController` | nested `SessionHistoryItem[]` | feeds Home (last 5), History tab (full), Profile tab (`computeBehavior`) |

All three verify `branch.userId === req.user!.userId` (mirror the ownership check already used in `exerciseService.submitPretest`); `req.user` comes from the already-active `AuthMiddleWare`.

New files: `src/controller/history.controller.ts`, `src/service/history.service.ts`, `src/dto/historyResponse.dto.ts` (new — distinct from the existing CRUD `src/dto/history.dto.ts`), `src/dto/branchDashboard.dto.ts`. Register `historyController`/`historyService` in `app.module.ts`; inject `historyService` into `branchController` so `/skills` and `/stats` reuse the same underlying query instead of duplicating joins.

`answer` (correct-answer text) needs no schema change: `CHOICE` → `exerciseChoices.find(c => c.isAnswer)?.script`; `FILL_IN_BLANK` → `exercise.fillInBlank`. Note: correctness for `FILL_IN_BLANK` is already evaluated **client-side** today (`G06_adaptive_learning/src/services/pretestService.ts::evaluateQuestionAtIndex`, respects `exercise.isCasesensitive` — case-insensitive unless `'YES'`) and the server just persists whatever `isCorrect` the client sends (`exercise.service.ts::submitPretest` line ~76, `isCorrect: answer.isCorrect`) — the History endpoint's `correct` field should likewise just read the stored `History.isCorrect` as-is, not recompute it. The only new thing needed is exposing `exercise.isCasesensitive` alongside `answer`/`chosen` in the session/question DTO, so the History tab UI can show *why* a fill-in-blank was marked right/wrong (e.g. a "Aa case-sensitive" badge) using the same rule `pretestService.ts` already applies.

### 1.4 Progress formula (BKT deferred, deliberately simple)
```
progressPercent(skillId, branchId) = round(correctCount / totalCount * 100)   // 0 if never attempted
```
Computed over `History` rows for the branch, joined through `sessionAndExercise.exercise.skillId`. Directly replaces the mock's `computeSkillProgress`.

### 1.5 Unlock rule
Stays **client-side** (mirrors current frontend logic): backend returns `progressPercent` per skill + the `skillPrequisite` relation; the 100%-of-all-parents comparison happens in the frontend controller (`utils/skillTree.ts`). Avoids duplicating unlock logic server- and client-side.

### 1.6 Avoiding N+1
`historyService` owns one shared query (joins `history → sessionAndExercise → exercise → skill`, `sessionAndExercise → session`, left-join `exercise.exerciseChoices`), filtered by `branchId`. `getSessionsForBranch` groups rows by `sessionId` into nested sessions. `branchController`'s `/skills` and `/stats` routes reuse the same raw rows (via injected `historyService`) to compute per-skill correct/total, distinct session count, and day-streak (port the exact consecutive-day algorithm from `fillAllForAdminManage`, scoped to one branch). `goalProgressPercent` = average `progressPercent` over the skillIds in `branch.goal.goalSkillRequire`.

## 2. Frontend data layer (`G06_adaptive_learning`)

### 2.1 New models
- `src/models/branchSkillModel.ts` — `BranchSkill` (skill fields + `progressPercent`), kept separate from the admin-CRUD `skillModel.ts`.
- `src/models/branchStatsModel.ts` — `BranchStats { skillsUnlockedCount, sessionsCount, dayStreak, goalProgressPercent }`.
- `src/models/sessionHistoryModel.ts` — `SessionHistoryQuestion`, `SessionHistoryItem` (nested), separate from the flat admin `historyModel.ts`.

### 2.2 New services (pattern: one full example, rest identical)
`src/component/home/branchSkill.service.ts` — same shape as `skill.service.ts`: class with an async method wrapping `AppClient.get(...)`, returning `ApiResponse<T>`, try/catch → `{isError, data, errorMessage}`. Same pattern for `branchStats.service.ts` (`GET /branch/:id/stats`) and `sessionHistory.service.ts` (`GET /history/branch/:id/sessions`).

### 2.3 New controllers/hooks (pattern: one full example, rest identical)
`src/component/home/controller/branchSkill.controller.ts` — hook-shaped function (`useState`/`useEffect`/`useCallback`), calls the service, unwraps `ApiResponse`, adds derived Elo-free logic ported from the current inline code: tree layout, unlocked set, `canUnlock` predicate. Exports `export type BranchSkillControllerType = ReturnType<typeof branchSkillController>` (borrowed from `usePretestController`'s convention). Same pattern for `branchStats.controller.ts` and `sessionHistory.controller.ts`.

**Data ownership across tabs** (avoid duplicate fetches, keep tree selection coherent):
- `HomeShell.tsx` calls `branchSkillController(activeBranch.id)` once, passes `treeSkills/unlocked/canUnlock/selected/setSelected` down to `HomeTab` and `SkillTreeTab`.
- `HomeTab.tsx` additionally calls `branchStatsController` and `sessionHistoryController` (sliced to last 5).
- `HistoryTab.tsx` and `ProfileTab.tsx` each call `sessionHistoryController` independently (full list) — same tradeoff as `adminHome`'s tabs each owning their own fetch; acceptable given data volume, not a shared cache.

### 2.4 Mock → real mapping

| Mock symbol | Replaced by |
|---|---|
| `SKILLS`, `getSkillTreeForGoal` | `branchSkillController` + new `utils/skillTree.ts::getSkillTreeForGoal` walking real `skillPrequisite`/`goalSkillRequire` |
| `MOCK_SESSIONS` | `sessionHistoryController` |
| `MOCK_USER_PROFILE` | already-real `AppContext.userProfile` (mock fallback removed) |
| `.xp`/`.level` on branch | **deleted** (Elo/Level scope removal) |
| `.streak` on branch | `branchStatsController().dayStreak` |
| `.unlockedSkills` | client-computed `unlocked` set in `branchSkillController` |
| `.sessions` | `sessionHistoryController` |
| `computeSkillProgress` | server-computed `progressPercent` |
| `computeUnlockedSkills` | `utils/skillTree.ts::computeUnlockedSkills` (Elo-free, tightened to the 100% rule) |
| `getSkillLevel`, `getSkillElo`, `ELO_RANGES` | **deleted entirely**, all Lv./Elo UI removed from `SkillTreeSVG`/`SkillSidePanel` |
| `GOAL_SKILLS`, `PREREQS` (with per-level granularity) | real `goal.goalSkillRequire` + `skill.skillPrequisite`, collapsed to the flat 100% rule |
| `buildCalendarActivity` | unused in current code — dropped, not ported |
| inline Elo-based `goalProgressPct` | `branchStatsController().goalProgressPercent` |

## 3. Frontend component split

New directory `src/component/home/`:
```
src/component/home/
  HomeShell.tsx            // navbar, tab switch, lifted skill-tree state, shared modals
  HomeTab.tsx               // stats grid + progress chips + embedded tree + last-5 sessions
  SkillTreeTab.tsx          // full zoomable tree + side panel, props-driven
  HistoryTab.tsx             // filters + full session list
  ProfileTab.tsx             // profile hero + behavior card + info/session-stat grids
  branchSkill.service.ts / branchStats.service.ts / sessionHistory.service.ts
  controller/
    branchSkill.controller.ts / branchStats.controller.ts / sessionHistory.controller.ts
  utils/
    skillTree.ts            // layoutSkills, getSkillTreeForGoal, computeUnlockedSkills, canUnlockSkill, getProgressColor, getNodeColors (Elo-free)
    behavior.ts              // computeBehavior, BEHAVIOR_META, DIM_LABELS (ported verbatim)
  skillTree/
    SkillTreeSVG.tsx / ZoomableSVG.tsx / SkillSidePanel.tsx
    NextExercisePicker.tsx / ExerciseConfirmModal.tsx
```

**Placement calls:**
- `SkillTreeSVG`/`ZoomableSVG`/`SkillSidePanel`/`NextExercisePicker`/`ExerciseConfirmModal` are used by 2 tabs (Home + SkillTree) but are graph/skill-tree-domain-specific, not platform-reusable — placed in `home/skillTree/` rather than `src/component/common/`. `common/` is reserved for domain-agnostic pieces plausibly reusable by `adminHome` too.
- **New in `src/component/common/`** (currently only has `GlobalLoader.tsx`, `LogoutButton.tsx`):
  - `StatCard.tsx` — generic number+label tile, replaces `HomeTab`'s stats-grid inline markup.
  - `ProgressBar.tsx` — generic 0–100 bar+color, consolidates 4 near-identical inline implementations (confirm modal, side panel, progress chips, tree nodes).
  - `SessionCard.tsx` — extracted from the current `renderSessionCard` closure, used by both `HomeTab` (last 5) and `HistoryTab` (full+filtered).
  - `Modal.tsx` — generic overlay+card wrapper, used by `ExerciseConfirmModal`/`NextExercisePicker` as thin content wrappers.

**Routing**: update both `Home`/`HomeNew` imports in `src/App.tsx` to point at `src/component/home/HomeShell.tsx`, then delete `src/component/Home.tsx` (confirmed no other importers). `src/component/SkillTree.tsx` (routed at `/skilltree`) is an unrelated legacy standalone mock component — out of scope, left untouched.

## 4. Mock data cleanup
Delete `src/component/mockData.js` and `src/data/mockData.js` (confirmed — both are only imported from `Home.tsx`, no other importers) once the replacements above are wired in.

## 5. Sequencing
1. **Backend entity + migration**: register `History`, add `chosenAnswer` + migration, verify column exists.
2. **Backend endpoints**: build `historyController`/`historyService` first (shared-query owner), then `branchController`'s `/skills` and `/stats`. Verify via curl/REST client — seed data has no `Session`/`SessionAndExercise`/`History` rows out of the box, so either drive a real pretest submission through `/exercise/pretest/submit` with a logged-in seeded user, or manually insert test rows via SQL for a quick smoke test.
3. **Backend `chosenAnswer` wiring**: update `PretestAnswerDto`/`submitPretest` and `usePretestController` together.
4. **Frontend data layer**: models → services → controllers, verified against the running backend before touching `Home.tsx`.
5. **Frontend common components**: `StatCard`/`ProgressBar`/`SessionCard`/`Modal` built and stubbed in isolation.
6. **Frontend component split**: build `home/` tree, wire controllers in, delete `Home.tsx`, update `App.tsx` imports.
7. **Mock cleanup**: delete both mock files last, after a final grep confirms zero remaining references.

## 6. Verification
1. Start backend (`npm run start:dev`) and frontend (`npm run dev`).
2. Log in as a real seeded student; ensure a branch exists; drive one pretest submission so `History` rows exist.
3. Home tab: stat grid, embedded tree, last-5 sessions all come from network responses (check DevTools Network, not stale `localStorage`) — no Lv./Elo badges anywhere.
4. SkillTree tab: zoom/pan works, lock/unlock state matches the real 100%-prerequisite rule, side panel shows real progress.
5. History tab: full list + filters work against real data, expanding a session shows real question text/skill/time/correct/chosen/answer (or "—" for legacy null rows).
6. Profile tab: behavior classification responds sensibly to real time/correct values; session-stat numbers match History tab counts.
7. Grep for `mockData`, `getSkillElo`, `getSkillLevel`, `ELO_RANGES`, `MOCK_` — zero remaining references under `src/component/home/` or `src/App.tsx`.
8. Confirm `kt.controller.ts`/`kt.service.ts`/`HttpModule` are still commented out in `app.module.ts` (untouched).

## 7. Future work: BKT/mastery integration (deferred, outline only)
When the pyBKT microservice is ready: uncomment `ktController`/`ktService`/`HttpModule` in `app.module.ts`; wire `Userprofile.conceptMapState` (currently unused nullable jsonb) as the persistent per-skill mastery cache, populated after each submitted session via calls to the KT service; replace the simple `correctCount/totalCount` formula (§1.4) with the real `pL` (probability of learning) estimate from pyBKT, feeding the same `progressPercent` field so the frontend contract doesn't change; loosen the prerequisite unlock rule from the current 100%-correctness placeholder down to **`pL >= 0.95`**, and have `goalProgressPercent` averaging operate on `pL` instead of raw correctness — minimal changes to `utils/skillTree.ts`.

### Critical files
- `G06_adaptive_learning/src/component/Home.tsx` (source of truth being split apart)
- `G06_adaptive_learning/src/App.tsx` (routing update)
- `G06_adaptive_learning/src/context/AppContext.tsx` (real branch data already partially wired)
- `G06_adaptive_learning/src/component/adminHome/skillPanel/skill.service.ts` + `skill.controller.ts` (pattern template)
- `adt-learning/server/app/src/app.module.ts` (entity/controller/provider registration)
- `adt-learning/server/app/src/entity/history.entity.ts`
- `adt-learning/server/app/src/service/user.service.ts` (`fillAllForAdminManage`, streak/aggregation template)
- `adt-learning/server/app/src/controller/branch.controller.ts` (new routes go here)
- `adt-learning/server/app/src/service/exercise.service.ts` (`submitPretest`, `chosenAnswer` wiring)
