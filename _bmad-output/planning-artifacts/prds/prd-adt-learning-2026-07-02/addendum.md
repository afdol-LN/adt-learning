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
To prevent mathematical stagnation (where a probability of $0.0$ or $1.0$ becomes immune to future evidence), values are clamped:
$$P(L_t) \leftarrow \max(0.01, \min(0.99, P(L_t)))$$

#### 1.1.4 Node Mastery Validation
A concept node is marked as completed when:
$$P(L_t) \ge 0.95$$

### 1.2 Initial BKT Probability Setup (Dynamic Onboarding Calibration)

Upon onboarding, the student's starting BKT mastery probability $P(L_0)$ is computed using a multi-factor combination of self-reported familiarity, pre-test correctness/speed, and profile metadata:
$$P(L_0) = P_{base}(Familiarity) + \Delta P(Pretest) + \Delta P(Profile)$$

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

The modular NestJS backend aligns with the following schema configurations:

### 2.1 Core Relational Structures
* **`Userprofile`**: Maps student credentials (`id`, `firstName`, `lastName`, `birthDate`, `campusId`, `facultyId`, `majorId`, `genderId`, `createdAt`, `updatedAt`, `behaviorScore`).
* **`Campus`, `Faculty`, `Major`**: Directories for Prince of Songkla University university structures.
* **`Exercise` & `ExerciseChoice`**: Relational tables for micro-exercise questions, correct choices, code snippets, and concept mapping tags.
* **`Session`**: Historical logs of user exercises.
* **`Branch` & `Goal`**: Path tracking nodes for dynamic dependencies.

### 2.2 Dynamic JSONB Configurations
To support the dynamic concept map resolver without schema migration overhead:
* **`Userprofile.conceptMapState` (JSONB)**: Stores the user's progress ($0-100\%$), current BKT mastery probability $P(L_t)$, and unlock status (`locked`, `unlocked`, `completed`) for each Concept Node ID.
* **`Userprofile.strengthWeaknessMatrix` (JSONB)**: Tracks the calculated strength/weakness vectors per category tag.

---

## 3. Rejected Alternatives & Technical Trade-offs

### 3.1 Real-Time Code Execution Sandboxes
* *Alternative:* Deploying a Docker-based execution sandbox (e.g., `isolate` or `Epicbox`) on the backend to execute student Python files dynamically.
* *Decision:* Rejected for v1 (MVP) due to security, performance, and operational complexity.
* *Trade-off:* Relies strictly on JSON code block string comparisons and regex-based blank matching. This maintains a sub-50ms roundtrip response time.

### 3.2 Standard GraphQL vs. REST + WebSocket
* *Alternative:* Using GraphQL for fetching nested concept trees.
* *Decision:* WebSockets (Socket.IO) are used for high-frequency interactive quiz loops, while standard REST serves static node metadata. This reduces frontend bundle size and setup latency.
