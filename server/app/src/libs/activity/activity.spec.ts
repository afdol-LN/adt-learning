import {
  ActivityFilterError,
  buildActivitySql,
  emptyActivityFilter,
  parseActivityFilter,
  parseActivityTypes,
  parsePage,
  parsePageSize,
  rowToEvent,
  totalPagesOf,
  MAX_ACTIVITY_PAGE_SIZE,
} from './activity';

describe('parseActivityTypes', () => {
  it('defaults to every type (also for "all")', () => {
    expect(parseActivityTypes()).toEqual(['goal', 'skill', 'exercise', 'login']);
    expect(parseActivityTypes('all')).toHaveLength(4);
  });
  it('keeps only known types', () => {
    expect(parseActivityTypes('login, goal,bogus')).toEqual(['goal', 'login']);
  });
  it('falls back to every type when nothing valid is asked for', () => {
    expect(parseActivityTypes('bogus')).toHaveLength(4);
  });
});

describe('parsePage / parsePageSize / totalPagesOf', () => {
  it('defaults page to 1 for missing or invalid input', () => {
    expect(parsePage()).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('2.5')).toBe(1);
    expect(parsePage('3')).toBe(3);
  });
  it('defaults and caps page size', () => {
    expect(parsePageSize()).toBe(20);
    expect(parsePageSize('-1')).toBe(20);
    expect(parsePageSize('9999')).toBe(MAX_ACTIVITY_PAGE_SIZE);
  });
  it('always reports at least one page', () => {
    expect(totalPagesOf(0, 20)).toBe(1);
    expect(totalPagesOf(20, 20)).toBe(1);
    expect(totalPagesOf(21, 20)).toBe(2);
  });
});

describe('parseActivityFilter', () => {
  it('treats a missing query as no filter', () => {
    expect(parseActivityFilter({})).toEqual(emptyActivityFilter());
  });
  it('parses every option', () => {
    const f = parseActivityFilter({
      userId: '4',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-08T00:00:00.000Z',
      goalId: '2',
      skillId: '7',
      event: 'ended',
      result: 'in_progress',
      sessionType: 'pretest',
      grade: 'poor',
      status: 'finished',
      hasWrong: 'true',
    });
    expect(f).toMatchObject({
      userId: 4,
      goalId: 2,
      skillId: 7,
      event: 'ended',
      result: 'in_progress',
      sessionType: 'pretest',
      grade: 'poor',
      status: 'finished',
      hasWrong: true,
    });
    expect(f.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
  it.each([
    [{ userId: 'x' }],
    [{ goalId: '-1' }],
    [{ from: 'not a date' }],
    [{ grade: 'excellent' }],
    [{ event: 'deleted' }],
    [{ from: '2026-09-08T00:00:00Z', to: '2026-09-01T00:00:00Z' }],
  ])('rejects %j', (q) => {
    expect(() => parseActivityFilter(q)).toThrow(ActivityFilterError);
  });
});

describe('buildActivitySql', () => {
  const none = emptyActivityFilter();

  it('only unions the sources of the chosen types', () => {
    const { pageSql, countSql } = buildActivitySql(['login'], none);
    expect(pageSql).toContain('"loginLog"');
    expect(pageSql).not.toContain('FROM history');
    expect(pageSql).not.toContain('UNION ALL');
    expect(countSql).toContain('COUNT(*)');
  });
  it('pages newest first with a stable tie-break, LIMIT/OFFSET after the filter params', () => {
    const { pageSql, params } = buildActivitySql(['goal'], none);
    expect(params).toEqual([null]);
    expect(pageSql).toContain('ORDER BY at DESC, id DESC LIMIT $2 OFFSET $3');
  });
  it('lists exercise activity as one row per session, not per answer', () => {
    const { pageSql } = buildActivitySql(['exercise'], none);
    expect(pageSql).toContain(`'exercise_session:' || se."sessionId"`);
    expect(pageSql).toContain('GROUP BY se."sessionId"');
  });
  it('binds every filter value as a parameter, never into the SQL text', () => {
    const f = {
      ...none,
      userId: 4,
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-08T00:00:00Z'),
      goalId: 2,
      skillId: 7,
      event: 'ended' as const,
      result: 'mastered' as const,
    };
    const { pageSql, countSql, params } = buildActivitySql(['skill'], f);
    expect(params).toEqual([
      4,
      '2026-09-01T00:00:00.000Z',
      '2026-09-08T00:00:00.000Z',
      2,
      7,
      ['session_ended'],
      'mastered',
    ]);
    expect(pageSql).toContain('LIMIT $8 OFFSET $9');
    expect(countSql).not.toMatch(/\$8|\$9/);
    expect(pageSql).not.toContain('mastered');
  });
  it('filters sessions by score band, type, status and wrong answers', () => {
    const { pageSql } = buildActivitySql(['exercise'], {
      ...none,
      grade: 'good',
      sessionType: 'practice',
      status: 'in_progress',
      hasWrong: true,
    });
    expect(pageSql).toContain('>= 55 AND');
    expect(pageSql).toContain('"isPretest" = false');
    expect(pageSql).toContain('"inProgress" = true');
    expect(pageSql).toContain('"correctCount" < "questionCount"');
  });
});

describe('rowToEvent', () => {
  it('nests the user and parses the time', () => {
    const e = rowToEvent({
      id: 'login:1',
      type: 'login',
      action: 'login',
      at: '2026-09-26T01:00:00.000Z',
      userId: 4,
      userName: 'A',
    });
    expect(e.user).toEqual({ id: 4, name: 'A' });
    expect(e.at).toBeInstanceOf(Date);
  });
});
