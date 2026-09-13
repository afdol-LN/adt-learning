# 0002 — Exercise: feedback only after the answer is checked, and a guide that costs no time

- **Status:** accepted
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

- `useExerciseController.submit()` set `responded` *before* awaiting `POST /session/:id/answer`, and `responded` is what showed the ✓/✗ flash. `lastCorrect` was never cleared between questions, so from the second question on, the flash showed the **previous** question's result while the new answer was still being checked. A failed request left `responded` stuck on and the page locked.
- Students had no explanation of the screen, or of the rules that decide their Progress: the question limit, the time ratio, and that a wrong answer can lower Progress.

## Decision

1. **An answer moves answering → checking → revealed.** While checking (request in flight), the answer is locked, the button reads "กำลังตรวจคำตอบ…", and no ✓/✗ is shown. The answer result `{ exerciseId, choiceId, isCorrect }` is created only from the response, belongs to that exercise, and is cleared when the next question loads. On reveal the chosen option turns green or red and the ✓/✗ flash shows for 1.2 s. A failed request goes back to answering with an error toast, and the student can submit again.
2. **The guide is two click-only controls at the top right of the Exercise topbar:**
   - **Tour**: driver.js, the same look as the Home tours. It steps through Progress, the question, the answer, submit, the question counter and the Rules button.
   - **Rules**: a card that drops down under the button.

   Neither one opens by itself.
3. **The answer-time clock is paused while the tour or the rules card is open.** The KT engine scales the learning gain by `expectTime / answerTime` (`ratio_time_response_exercise` in `btk-engine/app/models/bkt_kt_idem.py`), so reading the rules must not cost Progress. The clock is paused, not restarted, so opening the guide cannot be used to reset the time either.
4. **The rules card states only what the code enforces, and takes its numbers from the backend.** `questionLimit` is returned by `POST /session/start` (`SESSION_QUESTION_LIMIT`) rather than repeated in the frontend.

## Consequences

- The correct choice is still not revealed after a wrong answer, because `/answer` returns only `isCorrect`. Showing it would require the endpoint to return the correct choice.
- If `/answer` times out on the client (AppClient's 5 s) after the server already recorded the attempt, submitting again records a second attempt. It should be rare; add an idempotency check server-side if it shows up in history.
- The rules text lives in i18n (`exercise.rules.*`, `tour.exercise.*`). If `SESSION_QUESTION_LIMIT`, `MASTERY_THRESHOLD`, the prerequisite unlock threshold or the time formula changes, update those strings with it.
