import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';

async function campusSeed() {
  const db = await dataSource.initialize();
  const sql = `INSERT INTO "campus" ("id", "campus", "createdAt", "updatedAt")
      VALUES
        (1, 'Main Campus', NOW(), NOW()),
        (2, 'City Campus', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "campus" = EXCLUDED."campus",
        "updatedAt" = NOW()`;

  try {
    await db.query(sql);
    Logger.log('Campus seed completed successfully!');
  } catch (error: any) {
    Logger.error('Campus seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

campusSeed();
