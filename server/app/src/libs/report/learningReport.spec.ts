import {
  ANSWER_TIME_CAP_SECONDS,
  ReportAnswer,
  documentNo,
  effortOf,
  localDay,
  sessionLog,
  skillRows,
} from './learningReport';

// answer at a Bangkok-local wall time: "2026-09-01 10:00" → 03:00Z
const at = (local: string) => new Date(`${local.replace(' ', 'T')}:00+07:00`);
const answer = (
  over: Partial<ReportAnswer> & { end: string; seconds?: number },
): ReportAnswer => {
  const endTime = at(over.end);
  return {
    skillId: 1,
    sessionId: 1,
    isPretest: false,
    isCorrect: true,
    pL: 0.5,
    startTime: new Date(endTime.getTime() - (over.seconds ?? 30) * 1000),
    endTime,
    ...over,
  };
};
const skill = (over: Partial<Parameters<typeof skillRows>[0][number]> = {}) => ({
  skillId: 1,
  name: 'stack',
  tier: 'T1',
  required: true,
  progressPercent: 50,
  attemptCount: 3,
  ...over,
});

describe('skillRows', () => {
  it('dates mastery at the first practice answer that crossed P(L) 0.95', () => {
    const [row] = skillRows(
      [skill({ progressPercent: 100 })],
      [
        answer({ end: '2026-09-01 10:00', pL: 0.6 }),
        answer({ end: '2026-09-02 10:00', pL: 0.96, sessionId: 2 }),
        answer({ end: '2026-09-03 10:00', pL: 0.97, sessionId: 3 }), // a later review, not the moment
      ],
      new Map(),
    );
    expect(row).toMatchObject({
      status: 'mastered',
      masteredVia: 'practice',
      masteredAt: at('2026-09-02 10:00').toISOString(),
      practiceSessions: 3,
      practiceQuestions: 3,
    });
  });

  it('credits a skill the pretest mastered without any practice to the pretest', () => {
    const [row] = skillRows(
      [skill({ progressPercent: 100, attemptCount: 0 })],
      [answer({ end: '2026-09-01 09:00', isPretest: true, skillId: 1, pL: 0.99 })],
      new Map([[1, 100]]),
    );
    expect(row).toMatchObject({
      status: 'mastered',
      masteredVia: 'pretest',
      masteredAt: at('2026-09-01 09:00').toISOString(),
      startProgressPercent: 100,
      practiceQuestions: 0,
    });
  });

  it('never counts a pretest answer as the practice that mastered a skill', () => {
    const [row] = skillRows(
      [skill({ progressPercent: 100 })],
      [
        answer({ end: '2026-09-01 09:00', isPretest: true, pL: 0.99 }),
        answer({ end: '2026-09-02 10:00', pL: 0.96 }),
      ],
      new Map(),
    );
    expect(row.masteredVia).toBe('practice');
    expect(row.masteredAt).toBe(at('2026-09-02 10:00').toISOString());
  });

  it('follows the skill tree: 0 attempts is "not started", otherwise "in progress"', () => {
    const rows = skillRows(
      [skill({ skillId: 1, attemptCount: 0, progressPercent: 26.31 }), skill({ skillId: 2, attemptCount: 2 })],
      [],
      new Map(),
    );
    expect(rows.map((r) => r.status)).toEqual(['not_started', 'in_progress']);
    expect(rows[0].masteredAt).toBeNull();
  });

  it('only counts practice answers of that skill', () => {
    const [row] = skillRows(
      [skill()],
      [
        answer({ end: '2026-09-01 10:00', isCorrect: false }),
        answer({ end: '2026-09-01 10:01' }),
        answer({ end: '2026-09-01 10:02', skillId: 2 }),
        answer({ end: '2026-09-01 09:00', isPretest: true }),
      ],
      new Map(),
    );
    expect(row).toMatchObject({ practiceQuestions: 2, practiceCorrect: 1, practiceSessions: 1 });
  });
});

describe('effortOf', () => {
  it('sums sessions, pretest, accuracy, capped study time and local active days', () => {
    const e = effortOf([
      answer({ end: '2026-09-01 09:00', isPretest: true, sessionId: 9, isCorrect: false, seconds: 20 }),
      answer({ end: '2026-09-01 23:30', sessionId: 1, seconds: 40 }),
      // 00:30 Bangkok is still 17:30Z the day before — must count as a new local day
      answer({ end: '2026-09-02 00:30', sessionId: 2, seconds: 5 * 3600 }), // left open: capped
    ]);
    expect(e).toMatchObject({
      practiceSessions: 2,
      pretest: { correct: 0, total: 1, takenAt: at('2026-09-01 09:00').toISOString() },
      questions: 3,
      correct: 2,
      accuracyPercent: 67,
      studySeconds: 20 + 40 + ANSWER_TIME_CAP_SECONDS,
      firstActivityAt: at('2026-09-01 09:00').toISOString(),
      lastActivityAt: at('2026-09-02 00:30').toISOString(),
      activeDays: 2,
    });
  });

  it('is all zeros / nulls for a branch with no answers', () => {
    expect(effortOf([])).toEqual({
      practiceSessions: 0,
      pretest: null,
      questions: 0,
      correct: 0,
      accuracyPercent: 0,
      studySeconds: 0,
      firstActivityAt: null,
      lastActivityAt: null,
      activeDays: 0,
    });
  });
});

describe('documentNo / localDay', () => {
  it('uses the Bangkok calendar day', () => {
    const lateEvening = new Date('2026-09-26T18:00:00Z'); // 01:00 on the 27th in Bangkok
    expect(localDay(lateEvening)).toBe('2026-09-27');
    expect(documentNo('B', 12, lateEvening)).toBe('ALS-B12-20260927');
  });
});

describe('sessionLog', () => {
  it('lists sessions oldest first with their score', () => {
    const q = (isCorrect: boolean) => ({ isCorrect }) as any;
    const log = sessionLog([
      { sessionId: 2, startTime: new Date('2026-09-02T00:00:00Z'), endTime: new Date('2026-09-02T00:10:00Z'), isPretest: false, inProgress: false, skillNames: ['stack'], stopReason: 'mastered', progressBefore: null, progressAfter: 100, questions: [q(true), q(false)] },
      { sessionId: 1, startTime: new Date('2026-09-01T00:00:00Z'), endTime: new Date('2026-09-01T00:10:00Z'), isPretest: true, inProgress: false, skillNames: [], stopReason: null, progressBefore: null, progressAfter: null, questions: [q(true)] },
    ] as any);
    expect(log.map((s) => [s.sessionId, s.correct, s.total])).toEqual([
      [1, 1, 1],
      [2, 1, 2],
    ]);
  });
});
