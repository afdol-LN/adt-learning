import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';

async function genderSeed() {
  const db = await dataSource.initialize();
  const sql = `INSERT INTO "gender" ("id", "gender", "createdAt", "updatedAt")
      VALUES
        (1, 'Male', NOW(), NOW()),
        (2, 'Female', NOW(), NOW()),
        (3, 'Other', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "gender" = EXCLUDED."gender",
        "updatedAt" = NOW()`;

  const checkSql = `SELECT COUNT(*)::int AS count FROM "gender"`;

  try {
    await db.query(sql);
    const result = await db.query(checkSql);
    if (result[0].count === 0) {
      Logger.error('Gender seed has no data');
    } else {
      Logger.log(`Gender seed success: ${result[0].count} rows`);
    }
  } catch (error: any) {
    Logger.error('Gender seed failed', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

genderSeed();
