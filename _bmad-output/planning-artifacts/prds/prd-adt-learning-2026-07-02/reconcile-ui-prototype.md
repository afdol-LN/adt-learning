# Input Reconciliation — UI Prototype & ELO Purge

This document reconciles the generated PRD against the provided user inputs:
1. **Vite UI Prototype** (`D:\userprofile_project\UI\UI-prototype\go6-prototype`)
2. **Technical Research Report** on Notion Project 1.0

## 1. Reconciliation Audit
* **Pretest Flow:** The prototype's 5-question pretest is fully mapped to `FR-1.1` and `FR-1.2`. The dynamic onboarding math weights pretest correctness and speed alongside the academic year and major.
* **Concept Map (Skill Tree):** The React SVG tree structure layout is mapped to `FR-2.1`. The details panel showing node information, prerequisites, and descendant unlocks is represented in `FR-2.2`.
* **Adaptive Calculations (BKT Integration):** In accordance with the user's explicit directive, ELO calculation parameters are completely cleared. BKT (Bayesian Knowledge Tracing) is established as the sole algorithm for concept mastery state estimation (`FR-3.1` and `FR-3.2`).
* **Session Caching:** Caching session data in Redis before final flush is mapped to `FR-5.1` and `A-4`.

## 2. Gaps and Resolving Actions
* **Gap:** The frontend prototype calculates a student "Learning Persona" (Mastery, Fast, Steady, Slow, Struggler) using weighted behavior dimensions.
* **Resolution:** Since BKT is now the primary mastery and progress model, the behavioral profiler is retained in the PRD to calculate this student categorization (`FR-3.1` and `FR-3.2`), but the actual concept node locks and unlocks are driven purely by BKT probability $P(L_t) \ge 0.95$. This provides the best of both worlds: clean, simple graph traversal coupled with rich behavioral telemetry display in the student profile.
