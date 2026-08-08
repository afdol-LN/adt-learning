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
      INSERT INTO "campus" ("id", "campusId", "campus", "createdAt", "updatedAt")
      VALUES
        (5, '1', 'หาดใหญ่', NOW(), NOW()),
        (6, '2', 'ปัตตานี', NOW(), NOW()),
        (7, '3', 'ภูเก็ต', NOW(), NOW()),
        (8, '4', 'สุราษฎร์ธานี', NOW(), NOW()),
        (9, '5', 'ตรัง', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "campusId" = EXCLUDED."campusId",
        "campus" = EXCLUDED."campus",
        "updatedAt" = NOW();
    `);

    // 3. Faculty
    Logger.log('Seeding Faculty...');
    await db.query(`
      INSERT INTO "faculty" ("id", "facultyId", "faculty", "campusId", "createdAt", "updatedAt")
      VALUES
        (1, 'sci', 'วิทยาศาสตร์', 5, NOW(), NOW()),
        (2, 'eng', 'วิศวกรรมศาสตร์', 5, NOW(), NOW()),
        (3, 'bus', 'วิทยาการจัดการ', 5, NOW(), NOW()),
        (4, 'sci_g', 'วิทยาศาสตร์ (บัณฑิต)', 5, NOW(), NOW()),
        (5, 'bus_g', 'วิทยาการจัดการ (บัณฑิต)', 5, NOW(), NOW()),
        (6, 'sci_d', 'วิทยาศาสตร์ (ดุษฎีบัณฑิต)', 5, NOW(), NOW()),
        (7, 'edu', 'ศึกษาศาสตร์', 6, NOW(), NOW()),
        (8, 'huso', 'มนุษยศาสตร์และสังคมศาสตร์', 6, NOW(), NOW()),
        (9, 'coc', 'วิทยาลัยการคอมพิวเตอร์', 7, NOW(), NOW()),
        (10, 'fis', 'การบริการและการท่องเที่ยว', 7, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "facultyId" = EXCLUDED."facultyId",
        "faculty" = EXCLUDED."faculty",
        "campusId" = EXCLUDED."campusId",
        "updatedAt" = NOW();
    `);

    // 4. Major
    Logger.log('Seeding Major...');
    await db.query(`
      INSERT INTO "major" ("id", "majorId", "major", "facultyId", "createdAt", "updatedAt")
      VALUES
        (1, 'sci_1', 'คณิตศาสตร์', 1, NOW(), NOW()),
        (2, 'sci_2', 'ฟิสิกส์', 1, NOW(), NOW()),
        (3, 'sci_3', 'เคมี', 1, NOW(), NOW()),
        (4, 'sci_4', 'ชีววิทยา', 1, NOW(), NOW()),
        (5, 'sci_5', 'สถิติ', 1, NOW(), NOW()),
        (6, 'sci_6', 'เทคโนโลยีสารสนเทศและการสื่อสาร', 1, NOW(), NOW()),
        (7, 'eng_1', 'วิศวกรรมคอมพิวเตอร์', 2, NOW(), NOW()),
        (8, 'eng_2', 'วิศวกรรมไฟฟ้า', 2, NOW(), NOW()),
        (9, 'eng_3', 'วิศวกรรมโยธา', 2, NOW(), NOW()),
        (10, 'bus_1', 'บริหารธุรกิจ', 3, NOW(), NOW()),
        (11, 'bus_2', 'การตลาด', 3, NOW(), NOW()),
        (12, 'bus_3', 'การเงิน', 3, NOW(), NOW()),
        (13, 'bus_4', 'บัญชี', 3, NOW(), NOW()),
        (14, 'scig_1', 'คณิตศาสตร์ประยุกต์', 4, NOW(), NOW()),
        (15, 'scig_2', 'วิทยาศาสตร์การคำนวณ', 4, NOW(), NOW()),
        (16, 'busg_1', 'บริหารธุรกิจมหาบัณฑิต (MBA)', 5, NOW(), NOW()),
        (17, 'busg_2', 'การจัดการ', 5, NOW(), NOW()),
        (18, 'scid_1', 'คณิตศาสตร์ (ป.เอก)', 6, NOW(), NOW()),
        (19, 'scid_2', 'วิทยาศาสตร์การคำนวณ (ป.เอก)', 6, NOW(), NOW()),
        (20, 'coc_1', 'เทคโนโลยีสารสนเทศ', 9, NOW(), NOW()),
        (21, 'coc_2', 'วิศวกรรมซอฟต์แวร์', 9, NOW(), NOW()),
        (22, 'coc_3', 'ธุรกิจอิเล็กทรอนิกส์', 9, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "majorId" = EXCLUDED."majorId",
        "major" = EXCLUDED."major",
        "facultyId" = EXCLUDED."facultyId",
        "updatedAt" = NOW();
    `);

    // 5. Goal
    Logger.log('Seeding Goal...');
    await db.query(`
      INSERT INTO "goal" ("id", "goal", "goal_description", "status", "createdAt", "updatedAt")
      VALUES
        (1, 'Become a Full Stack Web Developer proficient in Frontend & Backend', 'Full Stack Dev', 'active', NOW(), NOW()),
        (2, 'Become a Backend Engineer specializing in Scalable APIs', 'Backend Dev', 'active', NOW(), NOW()),
        (3, 'Become a Data Scientist & AI Engineer', 'AI / Data Dev', 'active', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "goal" = EXCLUDED."goal",
        "goal_description" = EXCLUDED."goal_description",
        "status" = EXCLUDED."status",
        "updatedAt" = NOW();
    `);

    // 6. Skill
    Logger.log('Seeding Skill...');
    await db.query(`
      INSERT INTO "skill" ("skill_id", "skillCode", "skills_name", "tier", "status")
      VALUES
        (1, 'TYPESCRIPT', 'TypeScript', 'A', 'active'::skill_status_enum),
        (2, 'NESTJS', 'NestJS', 'A', 'active'::skill_status_enum),
        (3, 'POSTGRESQL', 'PostgreSQL', 'A', 'active'::skill_status_enum),
        (4, 'REACT', 'React', 'B', 'active'::skill_status_enum),
        (5, 'DOCKER', 'Docker', 'B', 'active'::skill_status_enum)
      ON CONFLICT ("skill_id") DO UPDATE SET
        "skillCode" = EXCLUDED."skillCode",
        "skills_name" = EXCLUDED."skills_name",
        "tier" = EXCLUDED."tier",
        "status" = EXCLUDED."status";
    `);

    // 7. GoalSkillRequire
    Logger.log('Seeding GoalSkillRequire...');
    await db.query(`
      INSERT INTO "GoalskillRequire" ("goal_id", "skill_id", "level_require")
      VALUES
        (1, 1, 3), (1, 2, 3), (1, 3, 2), (1, 4, 3),
        (2, 1, 3), (2, 2, 4), (2, 3, 4), (2, 5, 3),
        (3, 1, 2), (3, 3, 3), (3, 5, 3)
      ON CONFLICT ("goal_id", "skill_id") DO UPDATE SET
        "level_require" = EXCLUDED."level_require";
    `);

    // 8. Exercise
    Logger.log('Seeding Exercise...');
    await db.query(`
      INSERT INTO "exercise" ("id", "description", "level", "skill_level", "type", "status", "expect_time", "skill_id", "fillInBlank", "isCasesensitive", "createdAt", "updatedAt")
      VALUES
        (1, 'ผลลัพธ์ของโค้ด TypeScript: const x: number = 10; console.log(typeof x); คืออะไร?', 1, 1, 'CHOICE', 'active', 60, 1, NULL, 'NO', NOW(), NOW()),
        (2, 'คีย์เวิร์ดใดที่ใช้ประกาศตัวแปรที่มีค่าคงที่ (Constant) ใน TypeScript (พิมพ์คำศัพท์ 1 คำ)?', 1, 1, 'FILL_IN_BLANK', 'active', 45, 1, 'const', 'NO', NOW(), NOW()),
        (3, 'ใน NestJS เดคคอเรเตอร์ (Decorator) ใดใช้สำหรับระบุว่าคลาสเป็น Controller?', 2, 2, 'CHOICE', 'active', 60, 2, NULL, 'NO', NOW(), NOW()),
        (4, 'ใน NestJS หากต้องการฉีด Dependency (DI) เรามักใช้คีย์เวิร์ดใดหน้าพารามิเตอร์ใน constructor (เช่น ___ constructor(private readonly service: AppService))?', 2, 2, 'FILL_IN_BLANK', 'active', 45, 2, 'Injectable', 'NO', NOW(), NOW()),
        (5, 'คำสั่ง SQL ใดใช้สำหรับดึงข้อมูลจากตาราง (Table)?', 1, 1, 'FILL_IN_BLANK', 'active', 45, 3, 'SELECT', 'NO', NOW(), NOW()),
        (6, 'ใน React ฮุก (Hook) ใดใช้สำหรับจัดการ State ภายใน Functional Component?', 2, 2, 'CHOICE', 'active', 60, 4, NULL, 'NO', NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "description" = EXCLUDED."description",
        "level" = EXCLUDED."level",
        "skill_level" = EXCLUDED."skill_level",
        "type" = EXCLUDED."type",
        "skill_id" = EXCLUDED."skill_id",
        "fillInBlank" = EXCLUDED."fillInBlank",
        "updatedAt" = NOW();
    `);

    // 9. ExerciseChoice
    Logger.log('Seeding ExerciseChoice...');
    await db.query(`
      INSERT INTO "exerciseChoice" ("id", "exerciseId", "script", "isAnswer", "createdAt", "updatedAt")
      VALUES
        (1, 1, 'number', true, NOW(), NOW()),
        (2, 1, 'string', false, NOW(), NOW()),
        (3, 1, 'object', false, NOW(), NOW()),
        (4, 1, 'undefined', false, NOW(), NOW()),
        (5, 3, '@Controller()', true, NOW(), NOW()),
        (6, 3, '@Injectable()', false, NOW(), NOW()),
        (7, 3, '@Module()', false, NOW(), NOW()),
        (8, 3, '@Get()', false, NOW(), NOW()),
        (9, 6, 'useState()', true, NOW(), NOW()),
        (10, 6, 'useEffect()', false, NOW(), NOW()),
        (11, 6, 'useContext()', false, NOW(), NOW()),
        (12, 6, 'useReducer()', false, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "script" = EXCLUDED."script",
        "isAnswer" = EXCLUDED."isAnswer",
        "updatedAt" = NOW();
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
