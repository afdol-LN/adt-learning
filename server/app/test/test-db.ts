import { Client } from 'pg';

async function insertSeedData(): Promise<void> {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'dev', // ⚠️ เปลี่ยนเป็นชื่อ User ของคุณ
    password: '1234', // ⚠️ เปลี่ยนเป็นรหัสผ่านของคุณ
    database: 'adt_learning', // ⚠️ เปลี่ยนเป็นชื่อ Database ของคุณ
  });

  try {
    await client.connect();
    console.log('✅ เชื่อมต่อ Database สำเร็จ!');

    // ─── 1. INSERT Campus ────────────────────────────────────────────────
    console.log('\n📌 กำลัง INSERT ข้อมูล Campus...');
    const campusNames = ['Hatyai', 'Pattani', 'Trang'];
    const campusIds: number[] = [];

    for (const name of campusNames) {
      // ON CONFLICT DO NOTHING เพื่อไม่ให้ error เมื่อข้อมูลซ้ำ
      const res = await client.query<{ id: number }>(
        `INSERT INTO "Campus" ("campusName", "createdAt", "updatedAt")
         VALUES ($1, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [name],
      );
      if (res.rows.length > 0) {
        campusIds.push(res.rows[0].id);
        console.log(`  ✔ Campus "${name}" → id=${res.rows[0].id}`);
      } else {
        // ข้อมูลมีอยู่แล้ว ดึง id มาใช้ต่อ
        const existing = await client.query<{ id: number }>(
          `SELECT id FROM "Campus" WHERE "campusName" = $1`,
          [name],
        );
        campusIds.push(existing.rows[0].id);
        console.log(
          `  ⚠ Campus "${name}" มีอยู่แล้ว → id=${existing.rows[0].id}`,
        );
      }
    }

    // ─── 2. INSERT Faculty (ผูกกับ Campus แรก = Hatyai) ─────────────────
    console.log('\n📌 กำลัง INSERT ข้อมูล Faculty...');
    const facultyData = [
      { facultyName: 'Engineering', campusId: campusIds[0] },
      { facultyName: 'Science', campusId: campusIds[0] },
    ];
    const facultyIds: number[] = [];

    for (const f of facultyData) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO "Faculty" ("facultyName", "campusId", "createdAt", "updatedAt")
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [f.facultyName, f.campusId],
      );
      if (res.rows.length > 0) {
        facultyIds.push(res.rows[0].id);
        console.log(`  ✔ Faculty "${f.facultyName}" → id=${res.rows[0].id}`);
      } else {
        const existing = await client.query<{ id: number }>(
          `SELECT id FROM "Faculty" WHERE "facultyName" = $1`,
          [f.facultyName],
        );
        facultyIds.push(existing.rows[0].id);
        console.log(
          `  ⚠ Faculty "${f.facultyName}" มีอยู่แล้ว → id=${existing.rows[0].id}`,
        );
      }
    }

    // ─── 3. INSERT Major (ผูกกับ Faculty แรก = Engineering) ──────────────
    console.log('\n📌 กำลัง INSERT ข้อมูล Major...');
    const majorData = [
      { majorName: 'Computer Engineering', facultyId: facultyIds[0] },
      { majorName: 'Electrical Engineering', facultyId: facultyIds[0] },
    ];
    const majorIds: number[] = [];

    for (const m of majorData) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO "Major" ("majorName", "facultyId", "createdAt", "updatedAt")
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [m.majorName, m.facultyId],
      );
      if (res.rows.length > 0) {
        majorIds.push(res.rows[0].id);
        console.log(`  ✔ Major "${m.majorName}" → id=${res.rows[0].id}`);
      } else {
        const existing = await client.query<{ id: number }>(
          `SELECT id FROM "Major" WHERE "majorName" = $1`,
          [m.majorName],
        );
        majorIds.push(existing.rows[0].id);
        console.log(
          `  ⚠ Major "${m.majorName}" มีอยู่แล้ว → id=${existing.rows[0].id}`,
        );
      }
    }

    // ─── 4. INSERT Userprofile ────────────────────────────────────────────
    console.log('\n📌 กำลัง INSERT ข้อมูล Userprofile...');
    const userprofileData = [
      {
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '2000-01-15',
        campusId: campusIds[0],
        facultyId: facultyIds[0],
        majorId: majorIds[0],
        gender: 'Male',
        role: 'USER',
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        birthDate: '2001-05-20',
        campusId: campusIds[0],
        facultyId: facultyIds[1],
        majorId: majorIds[1],
        gender: 'Female',
        role: 'USER',
      },
    ];

    for (const u of userprofileData) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO "Userprofile"
           ("firstName", "lastName", "birthDate", "campusId", "facultyId", "majorId", "genderId", "role", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id`,
        [
          u.firstName,
          u.lastName,
          u.birthDate,
          u.campusId,
          u.facultyId,
          u.majorId,
          u.gender,
          u.role,
        ],
      );
      console.log(
        `  ✔ Userprofile "${u.firstName} ${u.lastName}" → id=${res.rows[0].id}`,
      );
    }

    console.log('\n🎉 INSERT ข้อมูลทั้งหมดสำเร็จ!');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', (error as Error).message);
  } finally {
    await client.end();
    console.log('🔌 ปิดการเชื่อมต่อแล้ว');
  }
}

// เรียกใช้ฟังก์ชัน
insertSeedData();
