import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import dataSource from 'src/config/data-source';

/**
 * Seed ข้อมูลนักเรียนจำลอง (mock) สำหรับใช้เดโมเท่านั้น
 * - ไม่แตะ Skill / Goal / Exercise ที่ Admin สร้างไว้แล้ว (ใช้ของที่มีอยู่จริงในฐานข้อมูล)
 * - สร้าง Userprofile + Branch + Session + SessionAndExercise + History จำลอง
 * - ทุก username ขึ้นต้นด้วย "demo_std" เพื่อให้ลบ/รันซ้ำได้ปลอดภัย ไม่ปนกับข้อมูลจริง
 *
 * วิธีรัน:  npm run seed:mock   (รันจาก server/app)
 * รันซ้ำได้เรื่อยๆ — สคริปต์จะลบข้อมูล demo_std เก่าทิ้งก่อนสร้างใหม่ทุกครั้ง
 */

// ต้องเหมือนกับ Hash.hashSha256 ใน src/libs/hash.ts เป๊ะๆ (ไม่มี salt)
function hashSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const DEMO_PASSWORD = 'Learn1234';
const USERNAME_PREFIX = 'demo_std';

const STUDENTS: { fullName: string; genderIndex: number }[] = [
  { fullName: 'ธนวัฒน์ ศรีสุข', genderIndex: 0 },
  { fullName: 'ปวีณา จันทร์เพ็ญ', genderIndex: 1 },
  { fullName: 'ณัฐพล วงศ์สวัสดิ์', genderIndex: 0 },
  { fullName: 'กัญญารัตน์ ทองดี', genderIndex: 1 },
  { fullName: 'ศุภกิจ มณีวรรณ', genderIndex: 0 },
  { fullName: 'อรพรรณ ไชยวงศ์', genderIndex: 1 },
  { fullName: 'ปิยะพงษ์ รักษ์ดี', genderIndex: 0 },
  { fullName: 'สุพัตรา แก้วมณี', genderIndex: 1 },
  { fullName: 'ธีรภัทร บุญมา', genderIndex: 0 },
  { fullName: 'วรัญญา หอมจันทร์', genderIndex: 1 },
  { fullName: 'กิตติศักดิ์ ประเสริฐ', genderIndex: 0 },
  { fullName: 'นภัสสร ศรีวิไล', genderIndex: 1 },
  { fullName: 'ชนาธิป เจริญสุข', genderIndex: 0 },
  { fullName: 'พิมพ์ชนก อินทร์แก้ว', genderIndex: 1 },
  { fullName: 'อดิศร คงเมือง', genderIndex: 0 },
  { fullName: 'ญาณิศา พรหมมา', genderIndex: 1 },
  { fullName: 'ภาณุวัฒน์ สายทอง', genderIndex: 0 },
  { fullName: 'เบญจวรรณ ทิพย์รัตน์', genderIndex: 1 },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function daysAgo(d: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt;
}

async function seedMockStudents() {
  Logger.log('Starting mock student seeding (DEMO DATA ONLY, prefix "demo_std")...');
  const db = await dataSource.initialize();

  try {
    // ---------- 0. ลบข้อมูล demo เก่า (ถ้าเคยรันมาก่อน) เพื่อให้รันซ้ำได้ ----------
    Logger.log('Cleaning up previous demo data (if any)...');
    await db.query(`
      DELETE FROM "history"
      WHERE "branchId" IN (
        SELECT b.id FROM "branch" b
        JOIN "userprofile" u ON u.id = b."userId"
        WHERE u.username LIKE '${USERNAME_PREFIX}%'
      );
    `);
    await db.query(`
      DELETE FROM "sessionAndExercise"
      WHERE "sessionId" IN (
        SELECT s."session_id" FROM "session" s
        JOIN "branch" b ON b.id = s."branchId"
        JOIN "userprofile" u ON u.id = b."userId"
        WHERE u.username LIKE '${USERNAME_PREFIX}%'
      );
    `);
    await db.query(`
      DELETE FROM "session"
      WHERE "branchId" IN (
        SELECT b.id FROM "branch" b
        JOIN "userprofile" u ON u.id = b."userId"
        WHERE u.username LIKE '${USERNAME_PREFIX}%'
      );
    `);
    await db.query(`
      DELETE FROM "branch"
      WHERE "userId" IN (SELECT id FROM "userprofile" WHERE username LIKE '${USERNAME_PREFIX}%');
    `);
    await db.query(`DELETE FROM "userprofile" WHERE username LIKE '${USERNAME_PREFIX}%';`);

    // ---------- 1. โหลดข้อมูลอ้างอิงที่มีอยู่จริงในฐานข้อมูล (ไม่สร้างของใหม่) ----------
    const genders: any[] = await db.query(`SELECT id FROM "gender" ORDER BY id`);
    const campuses: any[] = await db.query(`SELECT id FROM "campus" ORDER BY id`);
    const faculties: any[] = await db.query(`SELECT id FROM "faculty" ORDER BY id`);
    const majors: any[] = await db.query(`SELECT id FROM "major" ORDER BY id`);
    const goals: any[] = await db.query(
      `SELECT id FROM "goal" WHERE status = 'active'::goal_status_enum`,
    );
    const skills: any[] = await db.query(
      `SELECT "skill_id" AS "skillId", "tier", "pL0", "pT" FROM "skill" WHERE status = 'active'::skill_status_enum`,
    );
    const goalSkillRequire: any[] = await db.query(
      `SELECT "goal_id" AS "goalId", "skill_id" AS "skillId" FROM "GoalskillRequire"`,
    );
    const skillPrereq: any[] = await db.query(
      `SELECT "skill_id" AS "skillId", "prerequisite_skill" AS "prerequisiteSkillId" FROM "skills_prerequisite"`,
    );
    const exercises: any[] = await db.query(
      `SELECT id, "skill_id" AS "skillId", level, type, "fillInBlank" FROM "exercise" WHERE status = 'active'::exercise_status_enum`,
    );
    const choices: any[] = await db.query(
      `SELECT id, "exerciseId", script, "isAnswer" FROM "exerciseChoice"`,
    );

    if (goals.length === 0) {
      Logger.error('ไม่พบ Goal ในฐานข้อมูล — ให้ Admin สร้าง Goal/Skill ก่อน แล้วค่อยรัน seed นี้');
      return;
    }
    if (skills.length === 0) {
      Logger.error('ไม่พบ Skill ในฐานข้อมูล — ให้ Admin สร้าง Skill ก่อน แล้วค่อยรัน seed นี้');
      return;
    }

    const skillById = new Map<number, any>(skills.map((s: any) => [s.skillId, s]));
    const exercisesBySkill = new Map<number, any[]>();
    for (const ex of exercises) {
      const arr = exercisesBySkill.get(ex.skillId) || [];
      arr.push(ex);
      exercisesBySkill.set(ex.skillId, arr);
    }
    const choicesByExercise = new Map<number, any[]>();
    for (const c of choices) {
      const arr = choicesByExercise.get(c.exerciseId) || [];
      arr.push(c);
      choicesByExercise.set(c.exerciseId, arr);
    }

    // logic เดียวกับ SkillGraph.getRelevantSkillIds ในโค้ดจริง — ไล่ prerequisite ย้อนกลับจาก Goal
    function relevantSkillsForGoal(goalId: number): number[] {
      const requiredSkillIds = goalSkillRequire
        .filter((r: any) => r.goalId === goalId)
        .map((r: any) => r.skillId);
      const relevant = new Set<number>();
      const stack = [...requiredSkillIds];
      while (stack.length) {
        const id = stack.pop();
        if (relevant.has(id)) continue;
        relevant.add(id);
        const prereqs = skillPrereq.filter((p: any) => p.skillId === id);
        for (const p of prereqs) {
          if (!relevant.has(p.prerequisiteSkillId)) stack.push(p.prerequisiteSkillId);
        }
      }
      return [...relevant].sort((a, b) => {
        const ta = skillById.get(a)?.tier ?? 'Z';
        const tb = skillById.get(b)?.tier ?? 'Z';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a - b;
      });
    }

    let totalSessions = 0;
    let totalHistory = 0;

    for (let i = 0; i < STUDENTS.length; i++) {
      const student = STUDENTS[i];
      const username = `${USERNAME_PREFIX}${String(i + 1).padStart(2, '0')}`;
      const genderId = genders.length ? genders[student.genderIndex % genders.length].id : null;
      const campusId = campuses.length ? pick(campuses).id : null;
      const facultyId = faculties.length ? pick(faculties).id : null;
      const majorId = majors.length ? pick(majors).id : null;
      const year = randInt(1, 4);
      const birthYear = 2026 - (18 + year);
      const birthDate = `${birthYear}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
      const goal = pick(goals);
      const relevantSkills = relevantSkillsForGoal(goal.id);
      const progressPoint = relevantSkills.length ? randInt(0, relevantSkills.length - 1) : -1;

      const upResult = await db.query(
        `INSERT INTO "userprofile"
          ("fullName", "genderId", "birthDate", "campusId", "facultyId", "year", "majorId", "username", "password", "status", "behaviorScore", "role", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active'::userprofile_status_enum, $10, 'user'::userprofile_role_enum, $11, NOW())
         RETURNING id`,
        [
          student.fullName,
          genderId,
          birthDate,
          campusId,
          facultyId,
          year,
          majorId,
          username,
          hashSha256(DEMO_PASSWORD),
          randFloat(0.4, 0.95, 3),
          daysAgo(randInt(5, 45)),
        ],
      );
      const userId = upResult[0].id;

      const branchResult = await db.query(
        `INSERT INTO "branch" ("userId", "goalId", "exp_for_goal", "isAlreadyPretest", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id`,
        [userId, goal.id, 0, daysAgo(randInt(5, 40))],
      );
      const branchId = branchResult[0].id;

      const conceptMapState: Record<string, any> = {};
      let expForGoal = 0;

      for (let si = 0; si < relevantSkills.length; si++) {
        const skillId = relevantSkills[si];
        const skillRow: any = skillById.get(skillId);
        let status: string;
        let pL: number;
        let attemptCount: number;
        let level: number;

        if (si < progressPoint) {
          status = 'completed';
          pL = randFloat(0.95, 0.99, 2);
          attemptCount = randInt(5, 14);
          level = randInt(3, 5);
        } else if (si === progressPoint) {
          status = 'unlocked';
          pL = randFloat(0.3, 0.85, 2);
          attemptCount = randInt(1, 8);
          level = randInt(1, 3);
        } else {
          status = 'locked';
          pL = skillRow?.pL0 ?? 0.25;
          attemptCount = 0;
          level = 1;
        }

        conceptMapState[String(skillId)] = {
          pL,
          progress: Math.round(pL * 100),
          status,
          attemptCount,
          level,
        };

        if (attemptCount === 0) continue;
        const skillExercises = exercisesBySkill.get(skillId) || [];
        if (skillExercises.length === 0) continue;

        const sessionResult = await db.query(
          `INSERT INTO "session" ("create_at", "branchId", "skillId", "endedAt", "stopReason")
           VALUES ($1, $2, $3, $4, 'completed') RETURNING "session_id"`,
          [daysAgo(randInt(1, 30)), branchId, skillId, daysAgo(randInt(0, 29))],
        );
        const sessionId = sessionResult[0].session_id;
        totalSessions++;

        for (let a = 0; a < attemptCount; a++) {
          const exercise = pick(skillExercises);
          const isCorrect = Math.random() < pL;
          const exChoices = choicesByExercise.get(exercise.id) || [];
          let chosenAnswer: string | null = null;

          if (exercise.type === 'FILL_IN_BLANK') {
            chosenAnswer = isCorrect ? exercise.fillInBlank : 'ไม่ทราบคำตอบ';
          } else if (exChoices.length) {
            const correctChoice = exChoices.find((c: any) => c.isAnswer);
            const wrongChoices = exChoices.filter((c: any) => !c.isAnswer);
            chosenAnswer = isCorrect
              ? (correctChoice?.script ?? null)
              : (pick(wrongChoices.length ? wrongChoices : exChoices)?.script ?? null);
          }

          const saeResult = await db.query(
            `INSERT INTO "sessionAndExercise" ("exerciseId", "sessionId") VALUES ($1, $2) RETURNING id`,
            [exercise.id, sessionId],
          );
          const sessionAndExerciseId = saeResult[0].id;

          const start = daysAgo(randInt(0, 29));
          const end = new Date(start.getTime() + randInt(15, 90) * 1000);

          // หมายเหตุ: ผู้ทำครั้งแรกของ skill แรกเท่านั้นที่ถูกตั้งเป็น isPretest (ทำให้ข้อมูลดูสมจริงแบบง่ายๆ)
          await db.query(
            `INSERT INTO "history" ("branchId", "sessionAndExerciseId", "isCorrect", "isPretest", "startTime", "endTime", "chosenAnswer", "pL")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [branchId, sessionAndExerciseId, isCorrect, a === 0 && si === 0, start, end, chosenAnswer, pL],
          );
          totalHistory++;
        }

        expForGoal += attemptCount * 10;
      }

      await db.query(`UPDATE "branch" SET "exp_for_goal" = $1 WHERE id = $2`, [expForGoal, branchId]);
      await db.query(`UPDATE "userprofile" SET "conceptMapState" = $1 WHERE id = $2`, [
        JSON.stringify(conceptMapState),
        userId,
      ]);

      Logger.log(
        `  + ${username} (${student.fullName}) — Goal #${goal.id}, ทักษะที่เกี่ยวข้อง ${relevantSkills.length} ตัว`,
      );
    }

    Logger.log(
      `✅ Mock student seed completed: ${STUDENTS.length} users, ${totalSessions} sessions, ${totalHistory} history rows`,
    );
    Logger.log(
      `   Username: ${USERNAME_PREFIX}01 ... ${USERNAME_PREFIX}${String(STUDENTS.length).padStart(2, '0')} | Password (ทุกคน): ${DEMO_PASSWORD}`,
    );
  } catch (error: any) {
    Logger.error('❌ Mock student seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

seedMockStudents();
