// Admin activity timeline — types, query parsing and the UNION ALL SQL builder.
// Pure (no TypeORM) so it can be unit-tested; activity.service.ts only executes what this builds.

export const ACTIVITY_TYPES = ['goal', 'skill', 'exercise', 'login'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityAction =
  | 'goal_started'
  | 'goal_completed'
  | 'session_started'
  | 'session_ended'
  | 'exercise_session'
  | 'login';

// Only what the timeline renders — no birth date, gender, behaviour score or P(L) (PDPA minimisation).
export interface ActivityEvent {
  id: string; // unique across sources, e.g. "exercise_session:123"
  type: ActivityType;
  action: ActivityAction;
  at: Date;
  user: { id: number; name: string };
  goalName?: string | null;
  skillName?: string | null;
  isPretest?: boolean | null;
  stopReason?: string | null;
  /** exercise rows are one per session: open it with GET /history/admin/session/:sessionId */
  sessionId?: number | null;
  questionCount?: number | null;
  correctCount?: number | null;
  inProgress?: boolean | null;
}

export interface ActivityPage {
  events: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_ACTIVITY_PAGE_SIZE = 20;
export const MAX_ACTIVITY_PAGE_SIZE = 100;

// ── filters ─────────────────────────────────────────────────────────────────
// Every filter is optional and narrows the whole union, so `total`/`totalPages` stay right.

export const STOP_REASONS = ['mastered', 'completed', 'exhausted', 'abandoned'] as const;
/** session score bands — the same cut-offs as the student history (`sessionGrade` on the frontend) */
export const GRADES = ['great', 'good', 'poor'] as const;

export interface ActivityFilter {
  userId: number | null;
  from: Date | null; // inclusive
  to: Date | null; // exclusive
  goalId: number | null;
  skillId: number | null;
  /** goal: started | completed; skill: started | ended */
  event: 'started' | 'completed' | 'ended' | null;
  /** skill tab: how the practice session ended, or still running */
  result: (typeof STOP_REASONS)[number] | 'in_progress' | null;
  /** exercise tab */
  sessionType: 'practice' | 'pretest' | null;
  grade: (typeof GRADES)[number] | null;
  status: 'finished' | 'in_progress' | null;
  hasWrong: boolean;
}

export type RawActivityQuery = Partial<Record<keyof ActivityFilter, string>>;

/** thrown for a value no screen would send — the service turns it into a 400 */
export class ActivityFilterError extends Error {}

function positiveInt(raw: string | undefined, name: string): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ActivityFilterError(`${name} must be a positive integer`);
  }
  return n;
}

function instant(raw: string | undefined, name: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new ActivityFilterError(`${name} must be an ISO date-time`);
  }
  return d;
}

function oneOf<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  name: string,
): T | null {
  if (!raw) return null;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new ActivityFilterError(`${name} must be one of ${allowed.join(', ')}`);
  }
  return raw as T;
}

export function parseActivityFilter(q: RawActivityQuery): ActivityFilter {
  const from = instant(q.from, 'from');
  const to = instant(q.to, 'to');
  if (from && to && from >= to) {
    throw new ActivityFilterError('from must be before to');
  }
  return {
    userId: positiveInt(q.userId, 'userId'),
    from,
    to,
    goalId: positiveInt(q.goalId, 'goalId'),
    skillId: positiveInt(q.skillId, 'skillId'),
    event: oneOf(q.event, ['started', 'completed', 'ended'] as const, 'event'),
    result: oneOf(q.result, [...STOP_REASONS, 'in_progress'] as const, 'result'),
    sessionType: oneOf(q.sessionType, ['practice', 'pretest'] as const, 'sessionType'),
    grade: oneOf(q.grade, GRADES, 'grade'),
    status: oneOf(q.status, ['finished', 'in_progress'] as const, 'status'),
    hasWrong: q.hasWrong === 'true',
  };
}

export const emptyActivityFilter = (): ActivityFilter => ({
  userId: null,
  from: null,
  to: null,
  goalId: null,
  skillId: null,
  event: null,
  result: null,
  sessionType: null,
  grade: null,
  status: null,
  hasWrong: false,
});

export function parseActivityTypes(raw?: string): ActivityType[] {
  if (!raw || raw === 'all') return [...ACTIVITY_TYPES];
  const wanted = raw.split(',').map((s) => s.trim().toLowerCase());
  const types = ACTIVITY_TYPES.filter((t) => wanted.includes(t));
  return types.length > 0 ? types : [...ACTIVITY_TYPES];
}

export function parsePage(raw?: string | number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function parsePageSize(raw?: string | number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_ACTIVITY_PAGE_SIZE;
  return Math.min(n, MAX_ACTIVITY_PAGE_SIZE);
}

export function totalPagesOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// ── SQL ─────────────────────────────────────────────────────────────────────

// Every branch of the UNION returns these columns in this order, so the rows line up.
// "goalId" / "skillIds" exist only so the outer WHERE can filter on them.
const COLS = `id, type, action, at, "userId", "userName", "goalId", "goalName", "skillIds", "skillName", "isPretest", "stopReason", "sessionId", "questionCount", "correctCount", "inProgress"`;

// the four session columns, for sources that are not an exercise session
const NO_SESSION = `NULL::int, NULL::int, NULL::int, NULL::boolean`;

// `$1` is always the userId filter (NULL = every user). It stays inside each source so Postgres
// can use the userId indexes instead of building every user's rows first.
const USER = `($1::int IS NULL OR u.id = $1::int)`;

const SOURCES: Record<ActivityType, string[]> = {
  goal: [
    `SELECT 'goal_started:' || b.id, 'goal', 'goal_started', b."createdAt", u.id, u."fullName", b."goalId", g.goal,
            NULL::int[], NULL::text, NULL::boolean, NULL::text, ${NO_SESSION}
       FROM branch b
       JOIN userprofile u ON u.id = b."userId"
       LEFT JOIN goal g ON g.id = b."goalId"
      WHERE b."createdAt" IS NOT NULL AND ${USER}`,
    `SELECT 'goal_completed:' || b.id, 'goal', 'goal_completed', b."goalCompletedAt", u.id, u."fullName", b."goalId", g.goal,
            NULL::int[], NULL::text, NULL::boolean, NULL::text, ${NO_SESSION}
       FROM branch b
       JOIN userprofile u ON u.id = b."userId"
       LEFT JOIN goal g ON g.id = b."goalId"
      WHERE b."goalCompletedAt" IS NOT NULL AND ${USER}`,
  ],
  // pretest sessions have skillId NULL and are not skill practice — the inner join on skill drops them.
  // Both rows of a session carry its stopReason / in-progress flag so "result" can filter either one.
  skill: [
    `SELECT 'session_started:' || s.session_id, 'skill', 'session_started', s.create_at, u.id, u."fullName", b."goalId", g.goal,
            ARRAY[s."skillId"], sk.skills_name, NULL::boolean, s."stopReason",
            NULL::int, NULL::int, NULL::int, (s."endedAt" IS NULL)
       FROM session s
       JOIN skill sk ON sk.skill_id = s."skillId"
       JOIN branch b ON b.id = s."branchId"
       JOIN userprofile u ON u.id = b."userId"
       LEFT JOIN goal g ON g.id = b."goalId"
      WHERE s.create_at IS NOT NULL AND ${USER}`,
    `SELECT 'session_ended:' || s.session_id, 'skill', 'session_ended', s."endedAt", u.id, u."fullName", b."goalId", g.goal,
            ARRAY[s."skillId"], sk.skills_name, NULL::boolean, s."stopReason",
            NULL::int, NULL::int, NULL::int, false
       FROM session s
       JOIN skill sk ON sk.skill_id = s."skillId"
       JOIN branch b ON b.id = s."branchId"
       JOIN userprofile u ON u.id = b."userId"
       LEFT JOIN goal g ON g.id = b."goalId"
      WHERE s."endedAt" IS NOT NULL AND ${USER}`,
  ],
  // one row per session that has at least one answer (pretests included), timed at its latest answer.
  // A session lives in one branch, so user/goal are constant within the group.
  exercise: [
    `SELECT 'exercise_session:' || se."sessionId", 'exercise', 'exercise_session', MAX(h."endTime"), u.id, u."fullName", b."goalId", g.goal,
            array_agg(DISTINCT e.skill_id), string_agg(DISTINCT sk.skills_name, ', '), bool_or(h."isPretest"), s."stopReason",
            se."sessionId", COUNT(*)::int, (COUNT(*) FILTER (WHERE h."isCorrect"))::int,
            (NOT bool_or(h."isPretest") AND s."endedAt" IS NULL)
       FROM history h
       JOIN branch b ON b.id = h."branchId"
       JOIN userprofile u ON u.id = b."userId"
       LEFT JOIN goal g ON g.id = b."goalId"
       JOIN "sessionAndExercise" se ON se.id = h."sessionAndExerciseId"
       JOIN exercise e ON e.id = se."exerciseId"
       LEFT JOIN skill sk ON sk.skill_id = e.skill_id
       LEFT JOIN session s ON s.session_id = se."sessionId"
      WHERE h."endTime" IS NOT NULL AND ${USER}
      GROUP BY se."sessionId", u.id, u."fullName", b."goalId", g.goal, s."stopReason", s."endedAt"`,
  ],
  login: [
    `SELECT 'login:' || l.id, 'login', 'login', l."loggedInAt", u.id, u."fullName", NULL::int, NULL::text,
            NULL::int[], NULL::text, NULL::boolean, NULL::text, ${NO_SESSION}
       FROM "loginLog" l
       JOIN userprofile u ON u.id = l."userId"
      WHERE ${USER}`,
  ],
};

const EVENT_ACTIONS: Record<NonNullable<ActivityFilter['event']>, ActivityAction[]> = {
  started: ['goal_started', 'session_started'],
  completed: ['goal_completed'],
  ended: ['session_ended'],
};

// rounded like the frontend's sessionScore, so a session lands in the same band on both screens
const SCORE = `round("correctCount" * 100.0 / NULLIF("questionCount", 0))`;
const GRADE_SQL: Record<(typeof GRADES)[number], string> = {
  great: `${SCORE} >= 80`,
  good: `${SCORE} >= 55 AND ${SCORE} < 80`,
  poor: `${SCORE} < 55`,
};

/**
 * One page of the timeline for the chosen types, newest first.
 * `params` feed both queries; the page query adds LIMIT/OFFSET as the next two placeholders.
 * Every value goes through a placeholder — nothing from the request is spliced into the SQL text.
 */
export function buildActivitySql(types: ActivityType[], f: ActivityFilter) {
  const params: unknown[] = [f.userId];
  const where: string[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  // "at" is a naive UTC timestamp; the bounds arrive as instants
  if (f.from) where.push(`at >= (${bind(f.from.toISOString())}::timestamptz AT TIME ZONE 'UTC')`);
  if (f.to) where.push(`at < (${bind(f.to.toISOString())}::timestamptz AT TIME ZONE 'UTC')`);
  if (f.goalId !== null) where.push(`"goalId" = ${bind(f.goalId)}::int`);
  if (f.skillId !== null) where.push(`${bind(f.skillId)}::int = ANY("skillIds")`);
  if (f.event) where.push(`action = ANY(${bind(EVENT_ACTIONS[f.event])}::text[])`);
  if (f.result === 'in_progress') where.push(`"inProgress" = true`);
  else if (f.result) where.push(`"stopReason" = ${bind(f.result)}::text`);
  if (f.sessionType) where.push(`"isPretest" = ${f.sessionType === 'pretest' ? 'true' : 'false'}`);
  if (f.grade) where.push(`(${GRADE_SQL[f.grade]})`);
  if (f.status) where.push(`"inProgress" = ${f.status === 'in_progress' ? 'true' : 'false'}`);
  if (f.hasWrong) where.push(`"correctCount" < "questionCount"`);

  const union = types
    .flatMap((t) => SOURCES[t])
    .join('\n UNION ALL \n');
  const filtered = `SELECT ${COLS} FROM (${union}) AS src(${COLS})${
    where.length ? ` WHERE ${where.join(' AND ')}` : ''
  }`;
  const n = params.length;
  return {
    params,
    pageSql: `${filtered} ORDER BY at DESC, id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
    countSql: `SELECT COUNT(*)::int AS total FROM (${filtered}) AS f`,
  };
}

export function rowToEvent(r: any): ActivityEvent {
  return {
    id: r.id,
    type: r.type,
    action: r.action,
    at: new Date(r.at),
    user: { id: r.userId, name: r.userName },
    goalName: r.goalName,
    skillName: r.skillName,
    isPretest: r.isPretest,
    stopReason: r.stopReason,
    sessionId: r.sessionId,
    questionCount: r.questionCount,
    correctCount: r.correctCount,
    inProgress: r.inProgress,
  };
}
