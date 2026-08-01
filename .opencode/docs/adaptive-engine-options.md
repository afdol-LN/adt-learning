# Adaptive Engine Options — Tracking and Item Selection

**Status:** Comparison for decision. Not a decision record — the outcome becomes ADR 0003.
**Question:** given the schema as it exists today, what engines can drive (a) mastery tracking
and (b) selecting the next exercise from the bank, besides BKT?

---

## 1. What the current schema can feed

Every method below needs the same core observation tuple:
**(student, item, correct, timing)**. Your schema already produces it:

```
history.branchId       -> branch.userId          -> student
history.sessionAndExerciseId -> sessionAndExercise.exerciseId -> exercise.skillId
history.isCorrect                                -> outcome
history.startTime / endTime                      -> response time
history.isPretest                                -> separates diagnostic from practice
```

Two assets most projects lack at this stage:

- **`exercise.level`** — a human-assigned difficulty label. A free prior for any
  difficulty-based method.
- **`exercise.expectTime`** — expected duration, which makes speed a usable signal.

### Constraints that apply to every option

| Constraint | Detail |
|---|---|
| **3-hop join** | `history` has no `skillId`. Every mastery update joins `history → sessionAndExercise → exercise` to find the skill. Denormalise `skillId` onto `history` if update frequency matters. |
| **No answer text** | `history` stores only `isCorrect`. Any method is blind to *how* a student was wrong — no distractor analysis, no partial credit, no diagnosing a fill-in-blank normalisation bug. |
| **No per-student session link** | `session` has only `session_id` and `create_at` — no `userId`, no `skillId`. Session-level features are not directly queryable. |
| **In-memory engine state** | `btk-engine/app/storage.py` holds all parameters and mastery in Python dicts. Lost on restart, regardless of which method is chosen. |

---

## 2. The binding constraint is content, not algorithm

As observed in the running admin panel during this review: **6 skills, 6 exercises, 12 users.**

Adaptive selection from a bank of 6 items is close to meaningless — with roughly one item
per skill there is no choice to make. Every method below is bottlenecked on item volume
long before it is bottlenecked on algorithm quality.

> **Rule of thumb:** adaptive selection starts paying off at roughly 8–10 items per skill per
> difficulty band. At 6 items total, any of these engines will behave near-identically.

This does not mean the choice is unimportant — it means **the migration cost of the choice
matters more right now than its accuracy**, because accuracy differences cannot yet be
observed. Optimise for the option that is cheapest to adopt and cheapest to reverse.

---

## 3. Options against this schema

### 3.1 Elo (item-response Elo)

Treat student ability and item difficulty as symmetric ratings; both move after each attempt.

```
expected = 1 / (1 + 10^((b_item - theta_student) / 400))
theta_new = theta + K * (correct - expected)
b_new     = b     - K * (correct - expected)
```

- **Storage:** `exercise.eloRating` (1 new column). Student θ per skill fits inside the
  existing `conceptMapState` JSONB — **zero additional columns.**
- **Cold start:** none. Seed item difficulty from `exercise.level`
  (e.g. `b = 1200 + level × 150`) and let live attempts correct it.
- **Strength:** item difficulty becomes *self-calibrating*. This directly removes the
  parameter-provenance problem (PRD assumption A-5) — no hand-seeded `p_g`/`p_s`, no refit cycle.
- **Weakness — and it is a serious one here:** Elo produces a *rating*, not a probability.
  Your unlock rule (ADR 0002 §1) is `P(L_t) >= 0.95`, a probability of mastery. Elo cannot
  drive that rule without an added θ → probability mapping, which reintroduces exactly the
  kind of undefined conversion that D2/D3 were about.
- **Conflict to be aware of:** `reconcile-ui-prototype.md` §10 records an explicit directive
  that "ELO calculation parameters are completely cleared", with BKT as the sole mastery
  algorithm. See §5 below.

### 3.2 PFA (Performance Factors Analysis)

Logistic model over counts of prior successes and failures per skill.

```
m(student, skill) = beta_k + gamma_k * successes + rho_k * failures
P(correct)        = sigmoid(m)
```

- **Storage:** **zero new columns.** `successes` and `failures` are `COUNT` queries over
  `history` joined to `exercise.skillId`. Only a small parameters table is needed
  (`skill_id, beta, gamma, rho`).
- **Cold start:** needs roughly 200+ observations per skill to fit β/γ/ρ. Before that, use
  literature defaults or a shared global fit.
- **Strength:** outputs a probability directly, is interpretable, handles items that touch
  multiple skills, and fits with ordinary logistic regression — substantially easier than
  BKT parameter fitting.
- **Weakness:** `P(correct on next item)` is not the same quantity as `P(has mastered)`.
  It is monotonically related, so a threshold still works, but your Glossary defines mastery
  as a latent state, which is BKT-shaped. Also has no item-difficulty term unless extended.

### 3.3 IRT + CAT (Item Response Theory / Computerised Adaptive Testing)

`P(correct) = f(theta_student − b_item)`; select the item maximising Fisher information at
the current θ estimate.

- **Storage:** θ per student in `conceptMapState`; `exercise.level` seeds `b`.
- **Strength:** this is the *correct, principled* form of "difficulty-matched selection".
  A 5-question diagnostic that adapts as it goes **is** computerised adaptive testing.
- **Weakness:** classical IRT assumes θ is *static* during measurement. That is fine for a
  pretest and wrong for a practice loop, where the entire objective is θ increasing.
- **Best fit:** the pretest (FR-1.1/1.2), not the learning loop.

### 3.4 KT-IDEM (the incumbent)

BKT with guess/slip estimated per item rather than per skill.

- **Storage:** `skill.p_l0`, `skill.p_t`, `exercise.p_g`, `exercise.p_s` — **4 new columns**,
  the largest migration of any option here.
- **Cold start:** hand-seeded (PRD A-5), requiring a later refit that nobody currently owns
  (PRD §8 Open Question 4).
- **Strength:** already implemented and mathematically correct in
  `btk-engine/app/models/bkt_kt_idem.py`. Produces `P(L_t)` — the exact quantity the unlock
  rule, the Glossary, and the concept-map UI all already assume. Explainable to a student
  ("you are at 87% on Recursion").
- **Weakness:** most schema cost; per-item parameters are hard to estimate with a small bank.

### 3.5 Briefly considered and set aside

| Method | Why not now |
|---|---|
| **AFM** | Simpler PFA precursor (counts opportunities, not outcomes). Strictly less accurate than PFA for the same effort. |
| **DKT / SAKT / AKT** | Deep sequence models need on the order of 10k+ interaction sequences. You have effectively none. Also unexplainable — cannot tell a student why a node is locked, which your concept-map UI requires. |
| **Bandits / Thompson sampling** | Viable for selection, but needs a defined reward signal (learning gain? engagement?) that the PRD has not specified. |
| **Knowledge Space Theory** | You already have the useful part — `skillPrerequisite` is a prerequisite DAG. KST formalises it but does not replace a tracer. |

---

## 4. Elo vs PFA, head to head

The two genuine self-calibrating alternatives, judged against *this* schema.

| Dimension | Elo | PFA |
|---|---|---|
| New columns | 1 (`exercise.eloRating`) | 0 (+ small params table) |
| Calibrates item difficulty | **Yes, automatically** | No (not without an item term) |
| Output type | Rating (unbounded scale) | **Probability** |
| Works on day one | **Yes** | No — needs data to fit |
| Fits the `P(L_t) >= 0.95` unlock rule | **No** — needs a rating→probability mapping | Partially — threshold on a probability, but it is `P(correct)`, not `P(mastered)` |
| Handles multi-skill items | Poorly | **Yes** |
| Effort to reverse | Trivial (drop a column) | Trivial (drop a table) |
| Conflicts with a prior directive | **Yes** (§5) | No |

**Reading:** they solve *different* problems. Elo fixes **item calibration**; PFA fixes
**parameter fitting for student state**. Neither is a drop-in replacement for BKT, because
neither produces a latent mastery probability in the sense your Glossary, unlock rule, and
UI already depend on.

---

## 5. The ELO directive

`reconcile-ui-prototype.md` §10 states: *"In accordance with the user's explicit directive,
ELO calculation parameters are completely cleared. BKT ... is established as the sole
algorithm for concept mastery state estimation."*

Two readings, with different consequences:

- **Reading A — the purge targeted student-facing ratings.** PRD §5 Non-Goals already rules
  out RPG aesthetics, character levels, and ladders. If that was the concern, using Elo
  *internally* to calibrate `exercise` difficulty conflicts with nothing: no student ever
  sees a rating, and BKT remains the sole mastery estimator.
- **Reading B — the purge targeted the algorithm.** Then Elo is out entirely, and PFA is the
  route to self-calibration.

Note that the directive says Elo is cleared as an algorithm for **"concept mastery state
estimation"** — which is a narrower claim than "Elo may not be used for item difficulty."
Reading A is the more literal interpretation, but this needs your confirmation rather than
my inference.

---

## 6. Recommendation

**Keep KT-IDEM for mastery. Add Elo (or IRT) only where it removes a real problem.**

| Concern | Engine | Rationale |
|---|---|---|
| Pretest (FR-1.1/1.2) | **IRT / CAT** | A 5-item adaptive diagnostic is literally CAT. Seed `b` from `exercise.level`. |
| Item selection (FR-5.1) | **Elo rating** or IRT difficulty | Self-calibrating; removes the hand-seeded `p_g`/`p_s` dependency from the selection path. |
| Mastery state (FR-3.1/3.2) | **KT-IDEM (unchanged)** | Already built and correct. Produces `P(L_t)`, which the unlock rule, Glossary and UI all assume. Switching means re-opening ADR 0002. |

Why this split rather than a wholesale swap:

1. **It preserves ADR 0002.** The unlock rule you just settled is probability-shaped. Elo and
   PFA are not, so replacing BKT outright would force a third revision of the unlock
   semantics — the exact churn this PRD pass was meant to end.
2. **It reduces the migration.** Elo needs 1 column against KT-IDEM's 4. If Elo supplies item
   difficulty, `exercise.p_g`/`p_s` can be *derived* from the Elo rating rather than
   hand-seeded, shrinking assumption A-5 to a formula instead of a guessing exercise.
3. **It is reversible.** Dropping one column undoes it.

### Migration cost comparison

| Approach | New columns | Hand-tuned values | Refit cycle needed | ADR 0002 impact |
|---|---|---|---|---|
| KT-IDEM as currently specced | 4 | Yes (A-5) | Yes, unowned | None |
| **Recommended hybrid** | **2** (`eloRating`, + θ in JSONB) | **No** | No | None |
| Elo wholesale | 1 | No | No | **Re-opens unlock rule** |
| PFA wholesale | 0 | Defaults until fit | Yes | **Re-opens unlock rule** |

---

## 7. Decisions needed

1. **Reading A or B on the ELO directive** (§5) — determines whether Elo is available at all.
2. **Adopt the hybrid, or keep KT-IDEM as specced?** The hybrid removes assumption A-5 but
   adds an engine to the pretest path.
3. **Content volume** (§2) — none of this delivers value at 6 exercises. Is growing the item
   bank ahead of, or behind, the engine work?

Whatever is chosen, three things are required regardless:

- `history.skillId` denormalised, or accept the 3-hop join on every update.
- `history.submittedAnswer` added — without it no method can diagnose *why* answers fail.
- `btk-engine/app/storage.py` moved off in-memory dicts, or all state is lost on restart.
