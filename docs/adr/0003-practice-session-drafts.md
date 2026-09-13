# 0003 — An unfinished practice session is a draft the student resumes

- **Status:** accepted
- **Date:** 2026-09-13
- **Terms:** see [glossary](../glossary.md)

## Context

A student could not leave the Exercise page mid-session and come back. `POST /session/start` created a new `session` on every visit, so leaving meant losing your place: the question counter restarted, and the question on screen and any pick you hadn't submitted were gone. Every abandoned visit also left an open session (`endedAt` null) in the database.

Students need to switch to another skill and later continue exactly where they stopped.

## Decision

1. **An unfinished practice session is the student's draft for that skill in that branch.** `POST /session/start` resumes it instead of creating a session.
   - There is at most one draft per (branch, skill). `pickDraft` (`libs/session/sessionDraft.ts`) chooses the newest open session **that has answers**, otherwise the newest open one. Every other open session of that skill is closed with `stopReason = 'abandoned'`, so an empty visit can never bury real work.
   - Pretest sessions have no `branchId`/`skillId` and are never drafts.
2. **The draft keeps:**
   - **Answered questions:** these stay answered, already in `sessionAndExercise`/`history`.
   - **The same question:** `QuestionSelector.selectNext` is deterministic (closest to 70% predicted success, ties to the lowest id), so the same P(L) and the same unanswered set give back the question that was on screen. No new column or migration is needed.
   - **The answer picked or typed but not yet submitted:** kept in `localStorage` under `exerciseDraft:<sessionId>` by `exerciseDraft.service.ts`, and therefore on that browser only.

   `/session/start` also returns `resumed`, `answeredCount` and `correctCount`, so the question counter and the "N correct" summary continue across visits.
3. **Drafts never expire.** Sessions left open before this change count as drafts too. A draft with no questions left to ask (its exercises deactivated since) is closed as `exhausted` and a new session starts.
4. **On resume, the answer clock for the open question starts again from zero.** Time spent away is not counted.
5. **UI:**
   - Exercise gets an **"ออก"** button with a confirm dialog. The answer clock pauses while the dialog is open.
   - The Skill Tree node, side panel, confirm dialog and next-exercise picker show **"ทำค้างไว้ · N ข้อ"**, and the action becomes **"ทำต่อ"**. There is no discard option.
   - History marks unfinished sessions **"ทำค้างอยู่"**.
   - `getBranchSkills` returns `draftAnsweredCount` using the same `pickDraft` rule, so the badge and the resume always agree.

## Consequences

- **`QuestionSelector.selectNext` must stay deterministic.** Adding randomness would make a resumed draft show a different question than the one the student left.
- **The draft can drift from the question the student left:**
  - If an admin changes which exercises are active while a draft is open, the resumed question may differ.
  - If P(L) for the skill changes outside the session, it may also differ. Nothing does that today: the pretest only seeds skills that have no entry yet.
- **The unsent pick doesn't follow the student** to another device or browser.
- **A student can read a question, leave, and come back to answer it with a fresh clock** (decision 4). This was accepted over storing the question start time server-side.
- **The session popup's "Progress: start → end" starts from the resumed visit**, not from the first visit. Session-start Progress isn't stored.
- **The badge counts answered questions of the draft only**, not how many are left. The session can still end early (mastered or exhausted).
