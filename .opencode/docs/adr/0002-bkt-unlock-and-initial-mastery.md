# ADR 0002: BKT Unlock Rule, Initial Mastery, and Exercise Selection

## Status
Accepted

## Context

The PRD (`_bmad-output/planning-artifacts/prds/prd-adt-learning-2026-07-02/prd.html`,
Status: Final) and its addendum specify the BKT mastery loop. A review against the
actual schema and the `btk-engine` implementation found three defects that make the
spec unsafe to build from, plus one undefined input.

**1. `P(L_0)` can exceed the mastery threshold.** Addendum §1.2 defines

```
P(L_0) = P_base(Familiarity) + dP(Pretest) + dP(Profile)
```

with ceilings `0.75 + 0.15 + 0.09 = 0.99`. Addendum §1.1.3 clamps to
`max(0.01, min(0.99, ...))`, which permits `0.99`. FR-3.2 marks a node `completed`
once `P(L_t) >= 0.95`. An "Advanced" ICT year-2 student who does well on the pretest
therefore lands at `0.99` and is auto-mastered on every node before answering a
single exercise.

**2. The unlock rule contradicts itself.** Two incompatible rules are in circulation:

- "parent progress >= 60%" — PRD §3 Glossary, PRD §4.6, `docs/database_architecture.md`
  §3.1, `docs/glossary.md`
- "purely `P(L_t) >= 0.95`" — `reconcile-ui-prototype.md` §2

Worse, nothing in the spec produces a `progress` value *between* 0 and 100 (FR-3.2 sets
it to 100 on mastery; nothing sets it otherwise), so the 60% gate was unreachable in
practice.

**3. FR-5.1 mandates Case-Based Reasoning.** No case representation, similarity metric,
retention policy, or case-base table exists in the PRD, the schema, or the code.
`btk-engine/app/service/kt_service.py` implements KT-IDEM only.

**4. BKT parameters have no provenance.** KT-IDEM needs `p_l0`/`p_t` per skill and
`p_g`/`p_s` per item (`app/models/bkt_kt_idem.py`). The PRD never says where those
numbers come from, and there is no fitting step anywhere in the codebase.

## Decisions

### 1. Unlock is driven purely by `P(L_t) >= 0.95`

The 60% progress rule is **removed**. A Concept Node unlocks if and only if every
parent prerequisite in `skills_prerequisite` has reached `P(L_t) >= 0.95` in the
student's `conceptMapState`.

This adopts the rule already recorded in `reconcile-ui-prototype.md` §2 and discards
the competing one. Rationale: one metric, one source of truth. The trade-off is
accepted deliberately — a student must fully master a parent before any child opens,
which is stricter than the 60% gate would have been.

### 2. `progress` is display-only and derived

```
progress = min(100, round(P(L_t) / 0.95 * 100))
```

`progress` is a presentation value for the UI only. It **must not** gate any unlock,
state transition, or branch. It exists so the concept map can render a percentage bar;
`P(L_t)` remains the only decision variable.

This removes the "two competing metrics" problem at the root rather than defining a
second independent quantity that would need its own storage and tests.

### 3. `P(L_0)` is capped, and mastery requires evidence

Two independent guards (defence in depth — either alone would close the current hole,
but the pair also protects against future re-tuning of the ceilings):

- **Cap:** `P(L_0) = min(0.85, P_base + dP(Pretest) + dP(Profile))`. The general clamp
  in addendum §1.1.3 stays at `0.99` for the *running* `P(L_t)`; the `0.85` cap applies
  only to the onboarding value.
- **Attempt gate:** a node may not transition to `completed` unless the student has at
  least one recorded attempt against it (`history` row). Onboarding alone can never
  mark a node mastered.

Consequence: the pretest can place a student well up the tree, but the tree is never
skipped outright.

### 4. Exercise selection is difficulty-matched, not CBR

FR-5.1 becomes: select the next micro-exercise whose difficulty best matches the
student's current `P(L_t)`, using the per-item `p_g`/`p_s` the KT-IDEM engine already
stores. Case-Based Reasoning moves to §6.2 as deferred to v2.

Rationale: this is buildable today with the engine that exists, and it uses the same
per-item difficulty signal that motivated KT-IDEM over plain BKT in the first place.
Naming an unimplementable technique in a green-light-to-build document is worse than
scoping honestly.

### 5. BKT parameters are hand-seeded, then refit

Day-one defaults, to be stored on the `skill` and `exercise` rows:

| Parameter | Scope | Default |
|---|---|---|
| `p_g` | item, `CHOICE` | `1 / (number of choices)` — 0.25 for the standard 4-option item |
| `p_g` | item, `FILL_IN_BLANK` | `0.05` (guessing a free-text answer is near-impossible) |
| `p_s` | item | `0.10` |
| `p_t` | skill | `0.10` |
| `p_l0` | skill | per §3 above, from onboarding |

These are explicitly assumptions, not measurements. They are refit from real attempt
data after a pilot cohort. Deferring launch until parameters can be fitted is
circular — the data only exists once students use the system.

## Consequences

- PRD §3 Glossary, FR-1.2, FR-2.1, FR-2.2, FR-3.1, FR-3.2, FR-5.1, §4.6 and the
  Assumptions Index all change. Assumptions A-1 and A-2 are restated.
- The 60% rule must be removed from 6 files (11 occurrences), including both copies of
  `database_architecture.md`. `docs/database_architecture.md` becomes canonical.
- The follow-up schema migration must add `skill.p_l0`, `skill.p_t`, `exercise.p_g`,
  `exercise.p_s` — without them decisions 3 and 5 cannot be persisted, and KT-IDEM's
  per-item parameters are lost on every restart (`btk-engine/app/storage.py` currently
  holds them in memory only).
- The attempt gate in decision 3 requires the mastery check to read `history`, so the
  BKT bridge cannot be a pure function of `conceptMapState` alone.
- No case-base table is needed, since CBR is deferred.
