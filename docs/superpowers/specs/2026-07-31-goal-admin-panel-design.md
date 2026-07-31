# Goal Admin Panel — Design Spec

Date: 2026-07-31

## Summary

Add a "Goal" admin panel to the frontend admin home, mirroring the existing `skillPanel` pattern (list / view / edit / create), backed by a new `goal` REST resource on the NestJS backend. The backend controller/service for `Goal` do not currently exist (DTOs are stubs; entities are registered in `app.module.ts` but nothing consumes them). This also requires a schema change: `Goal.goal` becomes the canonical name field, `Goal.goalName` is renamed to `goalDescription` and widened, and a new `status` field is added.

## Scope

- New backend: `goal.controller.ts`, `goal.service.ts`, updated `goal.dto.ts`, a migration, registration in `app.module.ts`.
- New frontend: `goalPanel/` folder (tab, controller, service, form modal, view modal, skill-require editor, learning-tree diagram), wired into `Adminhome.tsx` as a new sidebar tab (no new route).
- Two existing backend call sites that reference `Goal.goalName` must be updated for the rename (see "Affected call sites").
- Frontend `goalName`/`GoalItem` references in the student onboarding flow (`informationModel.ts`, `CreateBranchModal.tsx`, `Home.tsx`, `mockData.js`, etc.) are a **separate, mock-data-driven system, unrelated to the `Goal` entity** — confirmed no coupling, out of scope, untouched.

## Requirements (from user)

- **List**: goal name, and the skill requirements of each goal.
- **View**: goal name, goal description, skill requirements, level required per skill, a learning-tree diagram, status.
- **Edit**: everything visible in view is editable; an Edit button is present both in the list and in the view.
- **Create**: same fields as view; the skill picker only offers skills that already exist in the system.
- **Component**: a skill-picker ("skill dropdown") used by the create/edit form.

## Field semantics (clarified during brainstorming)

`Goal` currently has two text columns whose names are misleading relative to their intended use:

| Current property | Current column | New role |
|---|---|---|
| `goal` | `goal` | **Primary name**, shown in the list, required on create |
| `goalName` | `goal_name`, `varchar(20)` | **Renamed to `goalDescription`**, column `goal_description`, widened to `varchar(255)` |

New field: `status` (reuses the existing `Status` enum — `active`/`inactive` — from `src/enums/status.enum.ts`), default `active`.

`GoalSkillRequire.levelRequire` already exists on the entity/DTOs — no schema change needed there, just needs to be wired through the new controller/service/UI.

**Required-name enforcement**: `goal` is required at the DTO validation layer (`@IsNotEmpty()`), not as a DB `NOT NULL` constraint — avoids migration failure risk against any existing rows with a `NULL` value.

**Delete behavior**: soft-delete only, via a status toggle exposed in the UI (unlike `skillPanel`, where the equivalent toggle exists in code but is currently hidden from the UI). No hard delete.

## Affected call sites (rename fallout)

`Branch` has a real FK relation to `Goal` (`branch.entity.ts`, `goalId` → `ManyToOne(Goal)`). Two backend call sites read `Goal.goalName` directly and must be updated:

- `service/user.service.ts:164` — admin user list resolves a user's goal name via `branch.goal?.goalName || branch.goal?.goal`. Since `goal` is now the canonical name, simplify to `branch.goal?.goal`.
- `service/exercise.service.ts:166` — pretest-by-goal lookup matches a string against `{goalName: goalId}` OR `{goal: goalId}`. Rename the `goalName` reference to `goalDescription`, preserving the existing OR-fallback behavior (matches either the name or the description column).

No other entity references `Goal`.

## Backend design

### Migration

New migration in `src/migrations/`:
1. Rename column `goal_name` → `goal_description` on `goal`, widen `varchar(20)` → `varchar(255)`.
2. Add `status` enum column to `goal` (reusing the `Status` enum type already used by `skill.status`), default `'active'`.

### Entity — `entity/goal.entity.ts`

- Rename property `goalName` → `goalDescription` (column `goal_description`, `varchar(255)`, nullable).
- Add `status: Status` (default `Status.ACTIVE`).

### DTOs — `dto/goal.dto.ts`

```ts
export class CreateGoalDto {
  @IsNotEmpty() goal: string;
  goalDescription?: string;
  status?: Status;
}
export class UpdateGoalDto {
  goal?: string;
  goalDescription?: string;
  status?: Status;
}
export class GoalSkillRequireItemDto {
  @IsNotEmpty() skillId: number;
  levelRequire?: number;
}
export class CreateGoalWithSkillRequireDto extends CreateGoalDto {
  @IsArray() skillRequires: GoalSkillRequireItemDto[];
}
export class UpdateGoalWithSkillRequireDto extends UpdateGoalDto {
  skillRequires?: GoalSkillRequireItemDto[];
}
```

(`dto/goalSkillRequire.dto.ts` already has `CreateGoalSkillRequireDto`/`UpdateGoalSkillRequireDto` — not used directly by a standalone controller, same precedent as `SkillPrerequisite`.)

### Service — `service/goal.service.ts`

`goalService extends BaseService<Goal>`, mirroring `skillService`:

- `findAll()` / `findOne(id)` — eager-load `relations: { goalSkillRequire: { skill: { skillPrequisite: { prerequisiteSkill: true } } } }` (nested), so the frontend has everything needed to render the dependency diagram without extra round trips.
- `remove(id)` — soft delete: sets `status = Status.INACTIVE` and saves (overrides `BaseController`'s default `DELETE :id` → `service.remove`, same as skill).
- `createGoalWithSkillRequire(dto)` — transaction: validates every `skillId` in `skillRequires` exists and is active (throws `BadRequestException` otherwise), creates the goal row, bulk-inserts `GoalSkillRequire` rows, re-fetches via `findOne`.
- `updateGoalWithSkillRequire(id, dto)` — transaction: updates goal columns if provided; if `skillRequires` is present, deletes all existing `GoalSkillRequire` rows for that goal id and re-inserts the new set (full replace, same pattern as `skillService.updateSkillWithPrerequisite`).

### Controller — `controller/goal.controller.ts`

`@Controller('/goal')`, `goalController extends BaseController<Goal>`:

- Inherited: `GET /goal`, `GET /goal/:id`, `POST /goal`, `PUT /goal/:id` (used for the plain status toggle from the UI), `DELETE /goal/:id` (soft delete).
- Added:
  - `POST /goal/with-skill-require` (body: `CreateGoalWithSkillRequireDto`) → `goalService.createGoalWithSkillRequire(dto)`
  - `PUT /goal/:id/with-skill-require` (body: `UpdateGoalWithSkillRequireDto`) → `goalService.updateGoalWithSkillRequire(id, dto)`

### `app.module.ts`

Import `goalController` and `goalService`, add both to `controllers: [...]` and `providers: [...]`. (`Goal`/`GoalSkillRequire` entities are already registered in `TypeOrmModule.forFeature`.)

## Frontend design

### `src/models/goalModel.ts` (new)

```ts
export interface Goal {
  id: number;
  goal: string;
  goalDescription?: string | null;
  status: string;
  goalSkillRequire?: GoalSkillRequireEntry[];
}
export interface GoalSkillRequireEntry {
  goalId: number;
  skillId: number;
  levelRequire: number | null;
  skill?: Skill; // nested; skill.skillPrequisite feeds the tree diagram
}
export interface GoalSkillRequireInput { skillId: number; levelRequire?: number; }
export interface CreateGoalRequest { goal: string; goalDescription?: string; status?: string; }
export interface UpdateGoalRequest { goal?: string; goalDescription?: string; status?: string; }
export interface CreateGoalWithSkillRequireRequest extends CreateGoalRequest { skillRequires: GoalSkillRequireInput[]; }
export interface UpdateGoalWithSkillRequireRequest extends UpdateGoalRequest { skillRequires?: GoalSkillRequireInput[]; }
```

### `src/component/adminHome/goalPanel/goal.service.ts` (new)

`GoalService` class mirroring `SkillService`'s `ApiResponse<T>`-wrapped shape:

- `getAllGoals(): ApiResponse<Goal[]>` → `GET /goal`
- `createGoalWithSkillRequire(data): ApiResponse<Goal>` → `POST /goal/with-skill-require`
- `updateGoalWithSkillRequire(goalId, data): ApiResponse<Goal>` → `PUT /goal/:id/with-skill-require`
- `updateGoalStatus(goalId, status): ApiResponse<Goal>` → `PUT /goal/:id` with `{status}`

No plain (non-composite) create/update methods — the UI always sends full view data including skill requirements.

### `goalPanel/goal.controller.ts` (new)

Hook `goalController()` mirroring `skill.controller.ts`:

- List state: `goals`, `isLoading`, `error`, `goalSearch` (client-side filter via `useMemo`).
- Form state: `isFormOpen`, `editingGoal`, `isSaving`, `formError`; `openCreateForm()`, `openEditForm(goal)`, `closeForm()`.
- View state: `viewingGoal`, `openView(goal)`, `closeView()`.
- `saveGoal(form)` — always calls `createGoalWithSkillRequire`/`updateGoalWithSkillRequire` (create/edit always carry skill requirements per the requirements above).
- `toggleGoalStatus(goal)` — calls `updateGoalStatus` with the flipped status.

### `goalPanel/GoalTab.tsx` (new)

Table: goal name (`goal`), status dot, skill-requirement count/summary, search box. Per-row: **Edit** button (opens form modal), **View** button (opens view modal), status-toggle control.

### `goalPanel/component/SkillRequireEditor.tsx` (new — the "skill dropdown" component)

Native `<select>` (`ad-select` class, matching `ExerciseFormModal`'s pattern) listing **active skills only**, excluding skills already added to the current list + a numeric level input + "Add" button. Appends to a row list (skill name, level, remove button). Used inside the form modal.

### `goalPanel/component/GoalFormModal.tsx` (new)

Single modal for both create and edit (`isEdit` branch, like `SkillFormModal`): `goal` (required text input), `goalDescription` (textarea), embedded `SkillRequireEditor`. No status field in the form — status is a separate toggle action in the list/view.

### `goalPanel/component/GoalViewModal.tsx` (new)

Read-only: `goal`, `goalDescription`, status, skill-requirement list (skill name + level), the `GoalLearningTree` diagram, and an **Edit** button that hands off to the form modal.

### `goalPanel/component/GoalLearningTree.tsx` (new)

Static SVG dependency diagram (not the pan/zoom engine from `SkillTree.tsx` — per user's choice of a simple diagram over full interactivity):

- Nodes: the goal's required skills.
- Edges: prerequisite relationships that exist **between pairs of required skills** (derived from the nested `skill.skillPrequisite` data already eager-loaded by the backend).
- Layered top-down layout by computed depth (BFS), no pan/zoom/search interactivity.

### `Adminhome.tsx`

Add `{ key: "goals", icon: <FaBullseye/>, label: "จัดการ Goal" }` to `TABS`; import `GoalTab`; add the matching `visitedTabs`-gated lazy-mount render block. No new router route (panels are tab-switched within `/admin/home`, not routed).

## Testing / verification

- **Backend**: `npm run lint`, `npm run build` (`nest build`); run the new migration against the dev DB and confirm `goal_description` (renamed, widened) and `status` columns land correctly without data loss; manually exercise `with-skill-require` create/update, plain status toggle, and soft-delete via the wired-up frontend or direct requests.
- **Frontend**: no test suite configured in this project. `npm run build` for type-check + build correctness; manual browser walkthrough of the golden path (list loads → create a goal with skill requirements → view renders the learning tree correctly → edit updates it → status toggle flips active/inactive) plus edge cases (a goal with zero skill requirements; a required skill with no prerequisite edges among the goal's other required skills).

## Out of scope

- The student-facing "select goal" onboarding flow (`informationModel.ts`, `CreateBranchModal.tsx`, `SelectBranchModal.tsx`, `Home.tsx`, `mockData.js`) — confirmed to be a separate mock-data system, not coupled to the `Goal` entity.
- Reworking `SkillTree.tsx`'s pan/zoom engine, or wiring it to real data — explicitly deferred in favor of the simpler static diagram.
- Any change to `SkillPrerequisite`/skill panel behavior.
