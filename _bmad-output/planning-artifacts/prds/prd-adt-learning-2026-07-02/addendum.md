# Addendum: PSU Adaptive Learning System (PSU ALS)

This document preserves the architectural designs, algorithmic details, database entities, and technical decisions that were analyzed during the BMad analysis phase but lie outside the functional boundaries of the main PRD.

---

## 1. Algorithmic Formulations

### 1.1 Bayesian Knowledge Tracing (BKT) Formulations

The BKT engine updates the student's latent knowledge state probability $P(L_t)$ for each Concept Node:

#### 1.1.1 Bayesian Update Step
Depending on the student's response correctness $C_t \in \{0, 1\}$ (0 for incorrect, 1 for correct), calculate the posterior probability of mastery $P(L_t | C_t)$:

* **If Correct ($C_t = 1$):**
  $$P(L_t | C_t = 1) = \frac{P(L_{t-1}) \cdot (1 - P(S))}{P(L_{t-1}) \cdot (1 - P(S)) + (1 - P(L_{t-1})) \cdot P(G)}$$

* **If Incorrect ($C_t = 0$):**
  $$P(L_t | C_t = 0) = \frac{P(L_{t-1}) \cdot P(S)}{P(L_{t-1}) \cdot P(S) + (1 - P(L_{t-1})) \cdot (1 - P(G))}$$

Where:
* $P(G)$ is the probability of a lucky Guess.
* $P(S)$ is the probability of a careless Slip.

#### 1.1.2 Transition Step (Incorporating Learning)
After updating the probability based on performance, account for learning transition $P(T)$ resulting from the attempt:
$$P(L_t) = P(L_t | C_t) + (1 - P(L_t | C_t)) \cdot P(T)$$

Where:
* $P(T)$ is the probability of learning transition.

#### 1.1.3 Numerical Clamping
To prevent mathematical stagnation (where a probability of $0.0$ or $1.0$ becomes immune to future evidence), the *running* mastery value is clamped:
$$P(L_t) \leftarrow \max(0.01, \min(0.99, P(L_t)))$$

> **Note:** this clamp applies to $P(L_t)$ as it evolves through attempts. It is deliberately
> wider than the onboarding cap in §1.2 — a student *should* be able to reach 0.99 by
> answering exercises. It must not be mistaken for a guard on the initial value; the
> 0.99 ceiling here is above the 0.95 mastery threshold, so §1.2's separate cap is what
> prevents auto-mastery at onboarding. See ADR 0002 §3.

#### 1.1.4 Node Mastery Validation
A concept node is marked as completed when **both** hold:
$$P(L_t) \ge 0.95 \quad \text{and} \quad \text{attempts}(node) \ge 1$$

The attempt gate ensures mastery always rests on observed evidence rather than on a
self-reported onboarding estimate. See ADR 0002 §3 and PRD FR-3.2.

### 1.2 Initial BKT Probability Setup (Dynamic Onboarding Calibration)

Upon onboarding, the student's starting BKT mastery probability $P(L_0)$ is computed using a multi-factor combination of self-reported familiarity, pre-test correctness/speed, and profile metadata, **capped at 0.85**:
$$P(L_0) = \min\left(0.85,\; P_{base}(Familiarity) + \Delta P(Pretest) + \Delta P(Profile)\right)$$

> **Why the cap.** The uncapped ceiling is $0.75 + 0.15 + 0.09 = 0.99$, which exceeds the
> $0.95$ mastery threshold in §1.1.4. Without the cap, an Advanced-familiarity ICT Year-2
> student who scores well on the pretest would be marked as having mastered every concept
> node before answering a single exercise, skipping the entire curriculum. The cap is one of
> two independent guards; the other is the attempt gate in §1.1.4. See ADR 0002 §3.

Where:
* **Familiarity Base Probability ($P_{base}$):**
  * Novice (T1 Foundation) = $0.15$
  * Intermediate (T2 Core) = $0.45$
  * Advanced (T3 Advanced) = $0.75$
* **Pre-test Performance Delta ($\Delta P(Pretest)$):** Up to $+0.15$ probability.
  $$\Delta P(Pretest) = (Accuracy \times 0.10) + (SpeedFactor \times 0.05)$$
  - $Accuracy$: Fraction of correct pretest answers (e.g., $3/5 = 0.6$).
  - $SpeedFactor$: $\max(0, \min(1, \frac{\text{ExpectedTime} - \text{ActualTime}}{\text{ExpectedTime}}))$ across questions.
* **Profile Metadata Delta ($\Delta P(Profile)$):** Up to $+0.09$ probability.
  - CS / ICT Major Match: $+0.05$ probability if the student's major matches target goals.
  - Academic Maturity: $+0.04$ probability for enrollment in Year 2 or above.

---

## 2. Database Entity Reference (PostgreSQL / TypeORM)

The modular NestJS backend aligns with the following schema configurations. The relational
schema is **15 tables** — earlier drafts said 13, omitting `history` and `sessionAndExercise`.

### 2.1 Core Relational Structures
* **`Userprofile`**: Maps student credentials (`id`, `fullName`, `birthDate`, `campusId`, `facultyId`, `majorId`, `genderId`, `username`, `password`, `status`, `role`, `createdAt`, `updatedAt`, `behaviorScore`). *Note: a single `fullName` column, not `firstName`/`lastName`.*
* **`Campus`, `Faculty`, `Major`**: Directories for Prince of Songkla University university structures.
* **`Exercise` & `ExerciseChoice`**: Relational tables for micro-exercise questions, correct choices, code snippets, and concept mapping tags.
* **`Session`**: Historical logs of user exercises. *Currently holds only `session_id` and `create_at` — it has no `userId` or `skillId`, so a Session cannot yet be attributed to a student or a concept node as the PRD Glossary defines it. See PRD §11.2.*
* **`SessionAndExercise`**: Join table linking a Session to the Exercises served in it.
* **`History`**: One row per recorded attempt (`isCorrect`, `isPretest`, `startTime`, `endTime`), linked to a Branch and a SessionAndExercise. Backs the attempt gate in §1.1.4. *Does not store the submitted answer text.*
* **`Branch` & `Goal`**: Path tracking nodes for dynamic dependencies.

### 2.2 Dynamic JSONB Configurations
To support the dynamic concept map resolver without schema migration overhead:
* **`Userprofile.conceptMapState` (JSONB)**: Stores the current BKT mastery probability $P(L_t)$, derived progress, unlock status (`locked`, `unlocked`, `completed`), and attempt count for each Concept Node ID. **`progress` is display-only** and derived as $\min(100, \operatorname{round}(P(L_t)/0.95 \times 100))$ — it never gates an unlock or a state transition, which depend on $P(L_t)$ alone. See ADR 0002 §2 and PRD §11.1.
* **`Userprofile.strengthWeaknessMatrix` (JSONB)**: Tracks the calculated strength/weakness vectors per category tag.

---

## 3. Rejected Alternatives & Technical Trade-offs

### 3.1 Real-Time Code Execution Sandboxes
* *Alternative:* Deploying a Docker-based execution sandbox (e.g., `isolate` or `Epicbox`) on the backend to execute student Python files dynamically.
* *Decision:* Rejected for v1 (MVP) due to security, performance, and operational complexity.
* *Trade-off:* Relies strictly on JSON code block string comparisons and regex-based blank matching. This keeps answer validation within the 50ms feedback budget (PRD FR-4.2); full settlement including the BKT call and persistence targets 200ms at p95.

### 3.3 Case-Based Reasoning for Exercise Selection
* *Alternative:* Selecting the next micro-exercise by retrieving similar past cases (student state, item, outcome) from a case base and adapting the retrieved solution.
* *Decision:* Deferred to v2. No case representation, similarity metric, or retention policy was ever specified, and a case base cannot be populated before v1 has collected attempt history.
* *Trade-off:* v1 selects on item difficulty matched to current $P(L_t)$ using the per-item $P(G)$/$P(S)$ that KT-IDEM already maintains. Less expressive than CBR, but buildable today and it reuses the signal that motivated KT-IDEM over plain BKT. See ADR 0002 §4.

### 3.2 Standard GraphQL vs. REST + WebSocket
* *Alternative:* Using GraphQL for fetching nested concept trees.
* *Decision:* WebSockets (Socket.IO) are used for high-frequency interactive quiz loops, while standard REST serves static node metadata. This reduces frontend bundle size and setup latency.
