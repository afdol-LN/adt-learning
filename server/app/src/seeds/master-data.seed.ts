import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';

async function seedMasterData() {
  Logger.log('Starting master data seeding...');
  const db = await dataSource.initialize();

  try {
    // 1. Gender
    Logger.log('Seeding Gender...');
    await db.query(`
      INSERT INTO "gender" ("id", "gender", "createdAt", "updatedAt")
      VALUES
        (1, 'Male', NOW(), NOW()),
        (2, 'Female', NOW(), NOW()),
        (3, 'Other', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "gender" = EXCLUDED."gender",
        "updatedAt" = NOW();
    `);

    // 2. Campus
    Logger.log('Seeding Campus...');
    await db.query(`
      INSERT INTO "campus" ("id", "campus", "createdAt", "updatedAt")
      VALUES
        (1, 'Main Campus', NOW(), NOW()),
        (2, 'City Campus', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "campus" = EXCLUDED."campus",
        "updatedAt" = NOW();
    `);

    // 3. Faculty
    Logger.log('Seeding Faculty...');
    await db.query(`
      INSERT INTO "faculty" ("id", "faculty", "campusId", "createdAt", "updatedAt")
      VALUES
        (1, 'Faculty of Engineering', 1, NOW(), NOW()),
        (2, 'Faculty of Science', 1, NOW(), NOW()),
        (3, 'Faculty of Information Technology', 2, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "faculty" = EXCLUDED."faculty",
        "campusId" = EXCLUDED."campusId",
        "updatedAt" = NOW();
    `);

    // 4. Major
    Logger.log('Seeding Major...');
    await db.query(`
      INSERT INTO "major" ("id", "major", "facultyId", "createdAt", "updatedAt")
      VALUES
        (1, 'Computer Engineering', 1, NOW(), NOW()),
        (2, 'Software Engineering', 1, NOW(), NOW()),
        (3, 'Computer Science', 2, NOW(), NOW()),
        (4, 'Information Technology', 3, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "major" = EXCLUDED."major",
        "facultyId" = EXCLUDED."facultyId",
        "updatedAt" = NOW();
    `);

    // 5. Goal
    Logger.log('Seeding Goal...');
    await db.query(`
      INSERT INTO "goal" ("id", "goal", "goal_name", "createdAt", "updatedAt")
      VALUES
        (1, 'Become a Full Stack Web Developer proficient in Frontend & Backend', 'Full Stack Dev', NOW(), NOW()),
        (2, 'Become a Backend Engineer specializing in Scalable APIs', 'Backend Dev', NOW(), NOW()),
        (3, 'Become a Data Scientist & AI Engineer', 'AI / Data Dev', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "goal" = EXCLUDED."goal",
        "goal_name" = EXCLUDED."goal_name",
        "updatedAt" = NOW();
    `);

    // 6. Skill
    Logger.log('Seeding Skill...');
    await db.query(`
      INSERT INTO "skill" ("skill_id", "skills_name", "tier", "status")
      VALUES
        (1, 'TypeScript', 'A', 1),
        (2, 'NestJS', 'A', 1),
        (3, 'PostgreSQL', 'A', 1),
        (4, 'React', 'B', 1),
        (5, 'Docker', 'B', 1)
      ON CONFLICT ("skill_id") DO UPDATE SET
        "skills_name" = EXCLUDED."skills_name",
        "tier" = EXCLUDED."tier",
        "status" = EXCLUDED."status";
    `);

    Logger.log('✅ Master data seed completed successfully!');
  } catch (error: any) {
    Logger.error('❌ Master data seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

seedMasterData();
