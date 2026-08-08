# Glossary

Terms used across the frontend (`G06_adaptive_learning`) and backend
(`adt-learning/server`), as they apply to the domain — not a restatement of
code, only terms whose meaning isn't obvious from the name alone.

- **Exercise** — a single question (`exercise` table): either a multiple
  choice (`CHOICE`) or a fill-in-the-blank (`FILL_IN_BLANK`) item, tied to
  one `Skill` at one `skillLevel`.
- **Level** (exercise) — the exercise's own difficulty. Admin-facing "Level"
  field on the Exercise tab; stored in both `Exercise.level` and
  `Exercise.skillLevel` (see ADR 0001 §1 for why there are two columns but
  one input).
- **Skill Level** (`skillLevel`) — the level within a `Skill`'s progression
  that this exercise counts toward for BKT/mastery purposes. Distinct from a
  student's *current* progress in `conceptMapState`.
- **Exercise Type** (`ExerciseType`) — `CHOICE` or `FILL_IN_BLANK`; determines
  which other Exercise fields are populated (`exerciseChoices` vs.
  `fillInBlank`/`isCasesensitive`).
- **Exercise Choice** — one answer option for a `CHOICE` exercise
  (`exerciseChoice` table); exactly one choice per exercise has
  `isAnswer: true`.
- **Fill In Blank** (`fillInBlank`) — the expected answer text for a
  `FILL_IN_BLANK` exercise; compared case-sensitively or not per
  `isCasesensitive`.
- **Status** (`Status` enum: `ACTIVE` / `INACTIVE`) — soft-delete flag shared
  across entities (`Exercise`, `Skill`, etc.). "Deleting" an Exercise sets
  this to `INACTIVE` rather than removing the row; toggling it back to
  `ACTIVE` "restores" it. See ADR 0001 §4.
- **Prerequisite unlock rule** — a `Skill` unlocks for a student only when
  *all* its parent prerequisites (`skillPrerequisite`) have reached >= 60%
  progress in that student's `conceptMapState`. Not directly touched by
  Exercise CRUD, but Exercises are the unit of practice that raises that
  progress.
- **conceptMapState** — JSON blob on `userprofile` caching a student's BKT
  mastery per skill, flushed from Redis to avoid write amplification on
  every attempt. Exercise attempts (not covered by this ADR) are what
  eventually update it.
- **BaseController<T> / BaseService<T>** — generic CRUD scaffold
  (`create`/`findAll`/`findOne`/`update`/`remove`) most entity
  controllers/services extend; resource-specific logic (like Exercise's
  type-conditional validation) overrides individual methods on top.
