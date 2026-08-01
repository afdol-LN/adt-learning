# ADR 0001: Exercise CRUD Tab in Admin Home

## Status
Accepted

## Context

Admin needs a new "Exercise" tab in `G06_adaptive_learning`'s admin home
(alongside the existing `skillPanel`, `userPanel`, `historyPanel`,
`summaryPanel`) to manage the `exercise` table directly, rather than only
through seeds/migrations.

Original request:
> insert: exercise description, level, select skill (only existing), select
> exercise type, add answer
> view
> delete: toggle status active <-> inactive
> update: can update all attributes

The backend (`adt-learning/server/app/src`) already has a working
`exerciseController` / `exerciseService` covering create, update, soft-delete,
and pretest retrieval. This ADR resolves ambiguities between that spec and the
actual schema (`Exercise` entity has both `level` and `skillLevel`; exercise
`type` branches into two different answer shapes) and records what, if
anything, needs to change on the backend.

## Decisions

### 1. Level field
`Exercise` has two numeric columns: `level` (exercise's own difficulty) and
`skillLevel` (the skill-tree level this exercise counts toward). Decision:
**expose a single "Level" field in the admin form**, describing the level of
that exercise. The frontend sends one value; it is submitted as
`skillLevel` in `CreateExerciseDto`/`UpdateExerciseDto`, and the backend
continues its existing behavior of mirroring that value into `level`
(`exerciseService.createExercise`/`updateExercise` already do
`level = dto.skillLevel`). No backend change needed here — only the frontend
form/model collapse the two into one visible input.

### 2. Skill select ("only existing")
The skill dropdown is populated from `GET /skill`, **filtered to
`status: ACTIVE`** skills only, reusing `skillPanel`'s existing service call
rather than adding a new endpoint. "Only existing" = only currently-active
skills are selectable; inactive skills are not offered (existing exercises
already pointing at a since-deactivated skill are left as-is on view/edit,
just not re-selectable for new links).

### 3. Exercise type / answer shape
`type` is `CHOICE | FILL_IN_BLANK` (`ExerciseType` enum). The form's answer
section is conditional on this selector:

- **CHOICE**: fixed **4 text inputs** + a radio group to mark exactly one as
  correct. Matches the seeded/mock data shape and simplifies the UI relative
  to the backend's actual constraint (>= 2 choices, exactly 1 correct) — 4 is
  the fixed count, not a floor.
- **FILL_IN_BLANK**: single "expected answer" text field (`fillInBlank`) +
  a "case sensitive" checkbox (`isCasesensitive`, stored as `'YES' | 'NO'`).

Switching type on Update re-renders the answer section and discards the
other shape's fields, matching `exerciseService.updateExercise`'s existing
behavior of clearing choices when switching to FILL_IN_BLANK (and vice versa
via `replaceChoices`).

### 4. Delete = two-way status toggle
"Delete" is not a hard delete. The list view's status control is a
**two-way toggle switch** (Active <-> Inactive) on each row:

- Active -> Inactive calls `DELETE /exercise/:id` (already implemented:
  `exerciseService.remove` sets `status = INACTIVE`, no row is destroyed).
- Inactive -> Active calls `PUT /exercise/:id` with `{ status: 'ACTIVE' }`
  (already supported: `updateExercise` applies `dto.status` and
  re-validates against the exercise's *existing* choices/fillInBlank, which
  are already valid, so this is a safe no-op on the answer data).

No new backend endpoint is required; the toggle is a UI affordance over the
two existing routes.

### 5. View scope
The list shows **both active and inactive** exercises (status shown as a
badge), with client-side filters for skill, exercise type, and level — the
admin needs to see inactive rows to toggle them back.

**Backend gap found and fixed as part of this work**: `GET /exercise`
(the inherited `BaseController.findAll` -> `BaseService.findAll`) returns
bare `Exercise` rows with no relations, so the table cannot show the skill's
name (only `skillId`). `exerciseService.findOne` already loads
`relations: { skill: true, exerciseChoices: true }` for the single-record
case; `findAll` needs the same `skill` relation (not `exerciseChoices` —
not needed in a list view) so the table can render skill name directly.
This requires overriding `findAll` in `exerciseService` similar to the
existing `findOne` override.

### 6. Update
Full edit form, all attributes editable (description, level, skill, type,
and the type-conditional answer fields), backed entirely by the existing
`PUT /exercise/:id` -> `updateExercise`.

## Consequences

- One backend change: override `exerciseService.findAll()` to include the
  `skill` relation.
- No new backend endpoints, DTOs, or migrations needed — the existing
  `CreateExerciseDto`/`UpdateExerciseDto` and routes cover every spec item.
- Frontend adds `src/component/adminHome/exercisePanel/` (service +
  controller + `ExerciseTab.tsx` + `component/` subfolder for the
  add/edit modal and table row), following the `skillPanel` pattern, plus
  `src/models/exerciseModel.ts` for the typed shapes.
- `Adminhome.tsx` and the route/tab list gain an "Exercise" entry.

## Open items deferred (not blocking this ADR)

- Whether inactive skills already referenced by existing exercises should
  render a warning on the exercise's edit view — left as future polish.
