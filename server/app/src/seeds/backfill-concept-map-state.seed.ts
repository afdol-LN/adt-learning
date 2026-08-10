import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';
import { MasteryState } from 'src/libs/bkt/masteryState';

async function backfillConceptMapState() {
  Logger.log('Starting conceptMapState backfill...');
  const db = await dataSource.initialize();

  try {
    const users: { id: number }[] = await db.query(`
      SELECT id FROM userprofile
      WHERE "conceptMapState" IS NULL OR "conceptMapState" = '{}'::jsonb
    `);
    Logger.log(`Found ${users.length} user(s) needing backfill`);

    for (const user of users) {
      const rows: { skill_id: number; pl0: number; total: string; correct: string }[] =
        await db.query(
          `
          SELECT
            e.skill_id AS skill_id,
            s."pL0" AS pl0,
            COUNT(*)::text AS total,
            SUM(CASE WHEN h."isCorrect" THEN 1 ELSE 0 END)::text AS correct
          FROM history h
          JOIN "sessionAndExercise" se ON h."sessionAndExerciseId" = se.id
          JOIN exercise e ON se."exerciseId" = e.id
          JOIN skill s ON e.skill_id = s.skill_id
          JOIN branch b ON h."branchId" = b.id
          WHERE b."userId" = $1
          GROUP BY e.skill_id, s."pL0"
        `,
          [user.id],
        );

      if (rows.length === 0) continue;

      const conceptMapState: Record<string, unknown> = {};
      for (const row of rows) {
        const total = Number(row.total);
        const correct = Number(row.correct);
        const accuracy = total > 0 ? correct / total : 0;
        // Heuristic: blend the population prior with observed accuracy,
        // capped below the mastery threshold — this is an approximation for
        // display continuity, not a real BKT re-derivation (that requires
        // replaying every attempt through /kt/attempt in order, which is out
        // of scope for a one-time backfill).
        const approxPL = Math.min(
          0.94,
          row.pl0 + accuracy * (0.94 - row.pl0),
        );
        conceptMapState[String(row.skill_id)] = MasteryState.buildEntry(
          approxPL,
          total,
        );
      }

      await db.query(
        `UPDATE userprofile SET "conceptMapState" = $1 WHERE id = $2`,
        [JSON.stringify(conceptMapState), user.id],
      );
      Logger.log(
        `Backfilled user ${user.id}: ${Object.keys(conceptMapState).length} skill(s)`,
      );
    }

    Logger.log('✅ conceptMapState backfill completed successfully!');
  } catch (error: any) {
    Logger.error('❌ conceptMapState backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

backfillConceptMapState();
