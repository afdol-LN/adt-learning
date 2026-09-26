# 0007 — Practising a completed skill is a review: P(L) stays frozen

- **Status:** accepted. Builds on [0004](0004-progress-two-decimals-truncated.md) (Progress = 100% exactly when P(L) ≥ 0.95).
- **Date:** 2026-09-25
- **Terms:** see [glossary](../glossary.md)

## Context

A student could open a skill already at 100% and practise it again. The first answer went through the KT engine as usual: a wrong answer pulled P(L) below 0.95, the skill dropped under 100%, and the skills after it could lock again. A right answer kept it at or above 0.95, and the session stopped straight away as `mastered` after a single question. So practising a completed skill was either risky or pointless.

The skill tree also kept drawing a completed skill with a percentage and a full bar, like any other skill in progress.

## Decision

1. **A skill whose P(L) is already ≥ 0.95 before an answer is being reviewed.** `submitAnswer` does not call the KT engine for that answer and does not write `branch.conceptMapState`. P(L), Progress and `attemptCount` stay exactly as they were: the P(L) of the answer that first took the skill to 100%.
2. **The answer is still recorded.** A `History` row is saved as usual, with the frozen P(L), so the review appears in the student's history.
3. **The next question is chosen with that frozen P(L).** `QuestionSelector.selectNext` gets the same P(L) on every answer of the review, so the questions stay at the level the student mastered.
4. **A review runs its full round.** It never ends as `mastered`: it ends after `SESSION_QUESTION_LIMIT` answers (`completed`) or when the skill runs out of questions (`exhausted`). It cannot complete the goal either, since nothing changes.
5. **Reaching 100% still ends a practice session on the spot.** The answer that first crosses 0.95 is not a review — P(L) was below 0.95 before it — so it updates mastery as usual and ends the session as `mastered`, whichever question of the round it is. The session never carries on as a review; practising the skill again later opens a new review session. (For a short while, 2026-09-25, a practice session was made to continue its round after reaching 100%. That was a misreading of the request and was reverted the next day.)
6. **Screens show "completed" instead of a number.** The frontend treats Progress = 100% (`isMastered`, the same test as P(L) ≥ 0.95) as completed: the skill-tree node shows "สำเร็จ" / "Completed" with no bar, and a review session on the Exercise screen shows a "completed · review mode" pill instead of the Progress number and bar. The answer sheet shows only right/wrong during a review, and a review session gets its own wording in the summary.

## Consequences

- Completion is effectively sticky per skill: once at 100%, practice can no longer take a skill (or the skills it unlocks) away.
- A session can still be short: if a student reaches 100% on question 1, that session ends after one question. Only reviews are guaranteed a full round.
- A few `conceptMapState` entries on the dev database may still carry `masteredInSessionId` / `completedGoal` from the reverted day. Nothing reads them any more; they are harmless and are dropped the next time that skill's entry is written.
- Review answers do not feed the KT engine, so they never refine the model's estimate for a mastered skill. That is deliberate — the student asked for practice, not a re-test.
- The review test is recomputed from P(L) on every answer; there is no stored "completed" flag. If P(L) of a completed skill is ever lowered by something other than practice (e.g. a pretest re-seed), that skill leaves review mode on its own.
