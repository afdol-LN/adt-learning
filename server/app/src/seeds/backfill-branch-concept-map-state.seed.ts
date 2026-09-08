import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';
import { MasteryState } from 'src/libs/bkt/masteryState';

interface BranchSkillRow {
  branch_id: number;
  skill_id: number;
  pl0: number;
  total: string;
  correct: string;
  latest_pl: number | null;
}

async function backfillBranchConceptMapState() {
  Logger.log('Starting per-branch conceptMapState backfill...');
  const db = await dataSource.initialize();

  try {
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

    const stateByBranch = new Map<number, Record<string, unknown>>();

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

    Logger.log(`Found ${stateByBranch.size} branch(es) needing backfill`);

    for (const [branchId, state] of stateByBranch) {
      await db.query(`UPDATE branch SET "conceptMapState" = $1 WHERE id = $2`, [
        JSON.stringify(state),
        branchId,
      ]);
      Logger.log(
        `Backfilled branch ${branchId}: ${Object.keys(state).length} skill(s)`,
      );
    }

    Logger.log('per-branch conceptMapState backfill completed successfully!');
  } catch (error: any) {
    Logger.error('per-branch conceptMapState backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

backfillBranchConceptMapState();
