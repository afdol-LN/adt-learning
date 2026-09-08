import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import dataSource from 'src/config/data-source';
import { ConceptMapState, MasteryState } from 'src/libs/bkt/masteryState';
import { PretestSeeder } from 'src/libs/bkt/pretestSeed';

interface BranchSkillRow {
  branch_id: number;
  skill_id: number;
  pl0: number;
  total: string;
  correct: string;
  latest_pl: number | null;
}

interface PretestGapRow {
  branch_id: number;
  exp_for_goal: number | null;
  state: ConceptMapState | null;
  skill_id: number;
  tier: string | null;
  year: number | null;
  is_about_cs: boolean;
}

// Pass 1 — rebuild each branch from its own attempt history.
async function backfillFromHistory(db: DataSource): Promise<void> {
  const rows: BranchSkillRow[] = await db.query(`
    SELECT
      b.id AS branch_id,
      e.skill_id AS skill_id,
      s."pL0" AS pl0,
      COUNT(*)::text AS total,
      SUM(CASE WHEN h."isCorrect" THEN 1 ELSE 0 END)::text AS correct,
      (ARRAY_AGG(h."pL" ORDER BY h.id DESC)
         FILTER (WHERE h."pL" IS NOT NULL))[1] AS latest_pl
    FROM branch b
    JOIN history h ON h."branchId" = b.id
    JOIN "sessionAndExercise" se ON h."sessionAndExerciseId" = se.id
    JOIN exercise e ON se."exerciseId" = e.id
    JOIN skill s ON e.skill_id = s.skill_id
    WHERE b."conceptMapState" IS NULL OR b."conceptMapState" = '{}'::jsonb
    GROUP BY b.id, e.skill_id, s."pL0"
    ORDER BY b.id
  `);

  const stateByBranch = new Map<number, ConceptMapState>();

  for (const row of rows) {
    const total = Number(row.total);
    const correct = Number(row.correct);
    const accuracy = total > 0 ? correct / total : 0;
    // Prefer the pL the BKT engine actually produced for this branch's most
    // recent attempt on this skill. Pretest rows carry no pL, so those skills
    // fall back to blending the population prior with observed accuracy,
    // capped below the mastery threshold — an approximation for display
    // continuity, not a real BKT re-derivation (that would mean replaying
    // every attempt through /kt/attempt in order).
    const pL =
      row.latest_pl === null || row.latest_pl === undefined
        ? Math.min(0.94, row.pl0 + accuracy * (0.94 - row.pl0))
        : Number(row.latest_pl);

    const state = stateByBranch.get(row.branch_id) ?? {};
    state[String(row.skill_id)] = MasteryState.buildEntry(pL, total);
    stateByBranch.set(row.branch_id, state);
  }

  Logger.log(`[pass 1] ${stateByBranch.size} branch(es) rebuilt from history`);

  for (const [branchId, state] of stateByBranch) {
    await db.query(`UPDATE branch SET "conceptMapState" = $1 WHERE id = $2`, [
      JSON.stringify(state),
      branchId,
    ]);
    Logger.log(
      `[pass 1] branch ${branchId}: ${Object.keys(state).length} skill(s)`,
    );
  }
}

// Pass 2 — a pretest seeds every goal skill, including ones the student never
// answered a question on. Those have no history row, so pass 1 cannot see
// them; recompute them with the same deterministic formula the pretest used.
async function seedUnansweredPretestSkills(db: DataSource): Promise<void> {
  const rows: PretestGapRow[] = await db.query(`
    SELECT
      b.id AS branch_id,
      b.exp_for_goal AS exp_for_goal,
      b."conceptMapState" AS state,
      g.skill_id AS skill_id,
      s.tier AS tier,
      u.year AS year,
      COALESCE(m."isAboutCs", false) AS is_about_cs
    FROM branch b
    JOIN "GoalskillRequire" g ON g.goal_id = b."goalId"
    JOIN skill s ON s.skill_id = g.skill_id
    JOIN userprofile u ON u.id = b."userId"
    LEFT JOIN major m ON m.id = u."majorId"
    WHERE b."isAlreadyPretest" = true
      AND (b."conceptMapState" IS NULL
           OR NOT (b."conceptMapState" ? g.skill_id::text))
    ORDER BY b.id
  `);

  const byBranch = new Map<number, PretestGapRow[]>();
  for (const row of rows) {
    byBranch.set(row.branch_id, [...(byBranch.get(row.branch_id) ?? []), row]);
  }

  Logger.log(
    `[pass 2] ${rows.length} unanswered pretest skill(s) across ${byBranch.size} branch(es)`,
  );

  for (const [branchId, branchRows] of byBranch) {
    const first = branchRows[0];
    const additions = PretestSeeder.missingEntries(
      first.state,
      branchRows.map((r) => ({ skillId: r.skill_id, tier: r.tier })),
      first.exp_for_goal,
      { isAboutCs: first.is_about_cs, year: first.year },
    );
    const merged = { ...(first.state ?? {}), ...additions };

    await db.query(`UPDATE branch SET "conceptMapState" = $1 WHERE id = $2`, [
      JSON.stringify(merged),
      branchId,
    ]);
    Logger.log(
      `[pass 2] branch ${branchId}: seeded ${Object.keys(additions).length} skill(s)`,
    );
  }
}

async function backfillBranchConceptMapState() {
  Logger.log('Starting per-branch conceptMapState backfill...');
  const db = await dataSource.initialize();

  try {
    await backfillFromHistory(db);
    await seedUnansweredPretestSkills(db);
    Logger.log('per-branch conceptMapState backfill completed successfully!');
  } catch (error: any) {
    Logger.error('per-branch conceptMapState backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

backfillBranchConceptMapState();
