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

    // 3. Faculty — PSU bachelor programs, from the TCAS70 course list (course.mytcas.com, university 010).
    // facultyId = "<TCAS campus id>-<TCAS faculty id>".
    Logger.log('Seeding Faculty...');
    await db.query(`
      INSERT INTO "faculty" ("id", "facultyId", "faculty", "campusId", "createdAt", "updatedAt")
      VALUES
        (1, '01-01', 'คณะวิศวกรรมศาสตร์', 5, NOW(), NOW()),
        (2, '01-02', 'คณะวิทยาศาสตร์', 5, NOW(), NOW()),
        (3, '01-03', 'คณะแพทยศาสตร์', 5, NOW(), NOW()),
        (4, '01-04', 'คณะพยาบาลศาสตร์', 5, NOW(), NOW()),
        (5, '01-05', 'คณะวิทยาการจัดการ', 5, NOW(), NOW()),
        (6, '01-06', 'คณะทรัพยากรธรรมชาติ', 5, NOW(), NOW()),
        (7, '01-08', 'คณะทันตแพทยศาสตร์', 5, NOW(), NOW()),
        (8, '01-09', 'คณะอุตสาหกรรมเกษตร', 5, NOW(), NOW()),
        (9, '01-10', 'คณะศิลปศาสตร์', 5, NOW(), NOW()),
        (10, '01-11', 'คณะนิติศาสตร์', 5, NOW(), NOW()),
        (11, '01-12', 'คณะเศรษฐศาสตร์', 5, NOW(), NOW()),
        (12, '01-13', 'คณะการแพทย์แผนไทย', 5, NOW(), NOW()),
        (13, '01-14', 'คณะเทคนิคการแพทย์', 5, NOW(), NOW()),
        (14, '01-15', 'วิทยาลัยนานาชาติ วิทยาเขตหาดใหญ่', 5, NOW(), NOW()),
        (15, '01-16', 'คณะสัตวแพทยศาสตร์', 5, NOW(), NOW()),
        (16, '01-17', 'โครงการจัดตั้งสถาบันสุวรรณภูมิ', 5, NOW(), NOW()),
        (17, '02-18', 'คณะศึกษาศาสตร์', 6, NOW(), NOW()),
        (18, '02-19', 'คณะวิทยาศาสตร์และเทคโนโลยี', 6, NOW(), NOW()),
        (19, '02-20', 'คณะมนุษยศาสตร์และสังคมศาสตร์', 6, NOW(), NOW()),
        (20, '02-21', 'คณะวิทยาการอิสลาม', 6, NOW(), NOW()),
        (21, '02-22', 'คณะศิลปกรรมศาสตร์', 6, NOW(), NOW()),
        (22, '02-23', 'คณะวิทยาการสื่อสาร', 6, NOW(), NOW()),
        (23, '02-24', 'คณะรัฐศาสตร์', 6, NOW(), NOW()),
        (24, '02-25', 'คณะพยาบาลศาสตร์ วิทยาเขตปัตตานี', 6, NOW(), NOW()),
        (25, '03-26', 'คณะการบริการและการท่องเที่ยว', 7, NOW(), NOW()),
        (26, '03-27', 'คณะวิเทศศึกษา', 7, NOW(), NOW()),
        (27, '03-28', 'คณะเทคโนโลยีและสิ่งแวดล้อม', 7, NOW(), NOW()),
        (28, '03-29', 'วิทยาลัยการคอมพิวเตอร์', 7, NOW(), NOW()),
        (29, '04-30', 'คณะวิทยาศาสตร์และเทคโนโลยีอุตสาหกรรม', 8, NOW(), NOW()),
        (30, '04-31', 'คณะศิลปศาสตร์และวิทยาการจัดการ', 8, NOW(), NOW()),
        (31, '04-33', 'คณะนวัตกรรมการเกษตร ประมง และอาหาร', 8, NOW(), NOW()),
        (32, '05-34', 'คณะพาณิชยศาสตร์และการจัดการ', 9, NOW(), NOW()),
        (33, '05-35', 'คณะสถาปัตยกรรมศาสตร์', 9, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "facultyId" = EXCLUDED."facultyId",
        "faculty" = EXCLUDED."faculty",
        "campusId" = EXCLUDED."campusId",
        "updatedAt" = NOW();
    `);

    // 4. Major — majorId = "<facultyId>-<running no.>". isAboutCs raises the
    // pretest P(L) prior (libs/bkt/pretestMastery.ts), so only computing majors get true.
    Logger.log('Seeding Major...');
    await db.query(`
      INSERT INTO "major" ("id", "majorId", "major", "facultyId", "isAboutCs", "createdAt", "updatedAt")
      VALUES
        (1, '01-01-01', 'วิศวกรรมศาสตร์', 1, false, NOW(), NOW()),
        (2, '01-01-02', 'วิศวกรรมการผลิต', 1, false, NOW(), NOW()),
        (3, '01-01-03', 'วิศวกรรมคอมพิวเตอร์', 1, true, NOW(), NOW()),
        (4, '01-01-04', 'วิศวกรรมเคมี', 1, false, NOW(), NOW()),
        (5, '01-01-05', 'วิศวกรรมเครื่องกล', 1, false, NOW(), NOW()),
        (6, '01-01-06', 'วิศวกรรมไฟฟ้า', 1, false, NOW(), NOW()),
        (7, '01-01-07', 'วิศวกรรมเมคาทรอนิกส์', 1, false, NOW(), NOW()),
        (8, '01-01-08', 'วิศวกรรมยาง (นานาชาติ)', 1, false, NOW(), NOW()),
        (9, '01-01-09', 'วิศวกรรมสิ่งแวดล้อม', 1, false, NOW(), NOW()),
        (10, '01-01-10', 'วิศวกรรมเหมืองแร่และวัสดุ', 1, false, NOW(), NOW()),
        (11, '01-01-11', 'วิศวกรรมเซมิคอนดักเตอร์', 1, false, NOW(), NOW()),
        (12, '01-01-12', 'วิศวกรรมอุตสาหการ', 1, false, NOW(), NOW()),
        (13, '01-01-13', 'วิศวกรรมและการจัดการนวัตกรรม (นานาชาติ)', 1, false, NOW(), NOW()),
        (14, '01-01-14', 'วิศวกรรมปัญญาประดิษฐ์', 1, true, NOW(), NOW()),
        (15, '01-02-01', 'วิทยาศาสตร์กายภาพและชีวภาพ', 2, false, NOW(), NOW()),
        (16, '01-02-02', 'วิทยาศาสตร์การคำนวณ', 2, true, NOW(), NOW()),
        (17, '01-02-03', 'วิทยาการคอมพิวเตอร์', 2, true, NOW(), NOW()),
        (18, '01-02-04', 'คณิตศาสตร์', 2, false, NOW(), NOW()),
        (19, '01-02-05', 'เคมี', 2, false, NOW(), NOW()),
        (20, '01-02-06', 'จุลชีววิทยา', 2, false, NOW(), NOW()),
        (21, '01-02-07', 'เคมี-ชีววิทยาประยุกต์', 2, false, NOW(), NOW()),
        (22, '01-02-08', 'ชีววิทยา', 2, false, NOW(), NOW()),
        (23, '01-02-09', 'เทคโนโลยีชีวภาพ', 2, false, NOW(), NOW()),
        (24, '01-02-10', 'ฟิสิกส์', 2, false, NOW(), NOW()),
        (25, '01-02-11', 'วัสดุศาสตร์', 2, false, NOW(), NOW()),
        (26, '01-02-12', 'สถิติประยุกต์และวิทยาการข้อมูล', 2, true, NOW(), NOW()),
        (27, '01-02-13', 'วิทยาศาสตร์พอลิเมอร์', 2, false, NOW(), NOW()),
        (28, '01-03-01', 'แพทยศาสตร์', 3, false, NOW(), NOW()),
        (29, '01-03-02', 'กายภาพบำบัด', 3, false, NOW(), NOW()),
        (30, '01-03-03', 'ปฏิบัติการฉุกเฉินการแพทย์', 3, false, NOW(), NOW()),
        (31, '01-04-01', 'พยาบาลศาสตร์', 4, false, NOW(), NOW()),
        (32, '01-05-01', 'ความเป็นผู้ประกอบการและธุรกิจยั่งยืน (นานาชาติ)', 5, false, NOW(), NOW()),
        (33, '01-05-02', 'การบัญชี', 5, false, NOW(), NOW()),
        (34, '01-05-03', 'บริหารธุรกิจ', 5, false, NOW(), NOW()),
        (35, '01-05-04', 'รัฐประศาสนศาสตร์', 5, false, NOW(), NOW()),
        (36, '01-06-01', 'เกษตรศาสตร์', 6, false, NOW(), NOW()),
        (37, '01-06-02', 'นวัตกรรมการเกษตรและการจัดการ', 6, false, NOW(), NOW()),
        (38, '01-06-03', 'สัตวศาสตร์', 6, false, NOW(), NOW()),
        (39, '01-06-04', 'วาริชศาสตร์', 6, false, NOW(), NOW()),
        (40, '01-08-01', 'ทันตแพทยศาสตร์', 7, false, NOW(), NOW()),
        (41, '01-09-01', 'วิทยาศาสตร์และเทคโนโลยีอาหาร', 8, false, NOW(), NOW()),
        (42, '01-09-02', 'การกำหนดอาหารและโภชนาการเพื่อสุขภาพ (นานาชาติ)', 8, false, NOW(), NOW()),
        (43, '01-09-03', 'เทคโนโลยีและการจัดการอุตสาหกรรมอาหาร', 8, false, NOW(), NOW()),
        (44, '01-09-04', 'เทคโนโลยีบรรจุภัณฑ์และวัสดุ', 8, false, NOW(), NOW()),
        (45, '01-10-01', 'การจัดการอุตสาหกรรมการบินและการบริการ', 9, false, NOW(), NOW()),
        (46, '01-10-02', 'ภาษาจีน', 9, false, NOW(), NOW()),
        (47, '01-10-03', 'ภาษาไทยประยุกต์', 9, false, NOW(), NOW()),
        (48, '01-10-04', 'ภาษาอังกฤษ', 9, false, NOW(), NOW()),
        (49, '01-10-05', 'ชุมชนศึกษาเพื่อการพัฒนา', 9, false, NOW(), NOW()),
        (50, '01-11-01', 'นิติศาสตร์', 10, false, NOW(), NOW()),
        (51, '01-12-01', 'เศรษฐศาสตร์', 11, false, NOW(), NOW()),
        (52, '01-12-02', 'เศรษฐศาสตร์ธุรกิจเกษตร', 11, false, NOW(), NOW()),
        (53, '01-13-01', 'การแพทย์แผนไทย', 12, false, NOW(), NOW()),
        (54, '01-14-01', 'เทคนิคการแพทย์', 13, false, NOW(), NOW()),
        (55, '01-15-01', 'สื่อสร้างสรรค์และเทคโนโลยีดิจิทัล (นานาชาติ)', 14, false, NOW(), NOW()),
        (56, '01-16-01', 'สัตวแพทยศาสตร์', 15, false, NOW(), NOW()),
        (57, '01-17-01', 'ศิลปะการแสดงและการจัดการทางวัฒนธรรม', 16, false, NOW(), NOW()),
        (58, '02-18-01', 'วัดผล-เทคโนโลยีสารสนเทศ', 17, false, NOW(), NOW()),
        (59, '02-18-02', 'เทคโนโลยีดิจิทัลและสื่อสารการศึกษา', 17, false, NOW(), NOW()),
        (60, '02-18-03', 'การสอนภาษา', 17, false, NOW(), NOW()),
        (61, '02-18-04', 'จิตวิทยาคลินิก', 17, false, NOW(), NOW()),
        (62, '02-18-05', 'ศึกษาศาสตร์', 17, false, NOW(), NOW()),
        (63, '02-18-06', 'การจัดการเรียนรู้วิทยาศาสตร์-คณิตศาสตร์', 17, false, NOW(), NOW()),
        (64, '02-19-01', 'เกษตรศาสตร์และประมง', 18, false, NOW(), NOW()),
        (65, '02-19-02', 'คณิตศาสตร์และวิทยาการคอมพิวเตอร์', 18, true, NOW(), NOW()),
        (66, '02-19-03', 'เคมี-ชีววิทยา', 18, false, NOW(), NOW()),
        (67, '02-19-04', 'วิทยาศาสตร์การอาหารและโภชนาการ', 18, false, NOW(), NOW()),
        (68, '02-19-05', 'โภชนศาสตร์และการกำหนดอาหาร', 18, false, NOW(), NOW()),
        (69, '02-19-06', 'ฟิสิกส์', 18, false, NOW(), NOW()),
        (70, '02-19-07', 'เทคโนโลยีและนวัตกรรมยาง', 18, false, NOW(), NOW()),
        (71, '02-20-01', 'บริหารธุรกิจ', 19, false, NOW(), NOW()),
        (72, '02-20-02', 'เศรษฐศาสตร์การประกอบการ', 19, false, NOW(), NOW()),
        (73, '02-20-03', 'สารสนเทศศาสตร์', 19, false, NOW(), NOW()),
        (74, '02-20-04', 'ประวัติศาสตร์', 19, false, NOW(), NOW()),
        (75, '02-20-05', 'การคิดเพื่อการพัฒนามนุษย์', 19, false, NOW(), NOW()),
        (76, '02-20-06', 'ภาษาเกาหลี', 19, false, NOW(), NOW()),
        (77, '02-20-07', 'ภาษาจีน', 19, false, NOW(), NOW()),
        (78, '02-20-08', 'ภาษาและวรรณคดีไทย', 19, false, NOW(), NOW()),
        (79, '02-20-09', 'ภาษาและวัฒนธรรมมลายู-อินโดนีเซีย', 19, false, NOW(), NOW()),
        (80, '02-20-10', 'ภาษาต่างประเทศศึกษา', 19, false, NOW(), NOW()),
        (81, '02-20-11', 'ภาษาอังกฤษ', 19, false, NOW(), NOW()),
        (82, '02-20-12', 'ภูมิศาสตร์', 19, false, NOW(), NOW()),
        (83, '02-20-13', 'สังคมวิทยาและมานุษยวิทยา', 19, false, NOW(), NOW()),
        (84, '02-20-14', 'พัฒนาสังคม', 19, false, NOW(), NOW()),
        (85, '02-20-15', 'สังคมสงเคราะห์ศาสตร์', 19, false, NOW(), NOW()),
        (86, '02-21-01', 'นวัตกรรมธุรกิจอิสลาม', 20, false, NOW(), NOW()),
        (87, '02-21-02', 'อิสลามศึกษาและกฎหมายอิสลาม', 20, false, NOW(), NOW()),
        (88, '02-21-03', 'อิสลามศึกษา (นานาชาติ)', 20, false, NOW(), NOW()),
        (89, '02-21-04', 'การสอนอิสลามศึกษา', 20, false, NOW(), NOW()),
        (90, '02-22-01', 'ศิลปกรรมศาสตร์', 21, false, NOW(), NOW()),
        (91, '02-23-01', 'คอมพิวเตอร์และวิทยาการสารสนเทศเพื่อการจัดการ', 22, true, NOW(), NOW()),
        (92, '02-23-02', 'นวัตกรรมการออกแบบสื่อ', 22, false, NOW(), NOW()),
        (93, '02-23-03', 'นิเทศศาสตร์', 22, false, NOW(), NOW()),
        (94, '02-24-01', 'รัฐศาสตร์', 23, false, NOW(), NOW()),
        (95, '02-25-01', 'พยาบาลศาสตร์', 24, false, NOW(), NOW()),
        (96, '03-26-01', 'การจัดการโรงแรมนานาชาติ อิเวนต์ และภัตตาคาร (นานาชาติ)', 25, false, NOW(), NOW()),
        (97, '03-26-02', 'การจัดการธุรกิจการท่องเที่ยวและการบิน (นานาชาติ)', 25, false, NOW(), NOW()),
        (98, '03-26-03', 'การเป็นผู้ประกอบการและนวัตกรรมทางธุรกิจ (นานาชาติ)', 25, false, NOW(), NOW()),
        (99, '03-27-01', 'ธุรกิจระหว่างประเทศ (นานาชาติ)', 26, false, NOW(), NOW()),
        (100, '03-27-02', 'ภาษาและวัฒนธรรม (นานาชาติ)', 26, false, NOW(), NOW()),
        (101, '03-27-03', 'ภาษาอังกฤษเพื่อธุรกิจระหว่างประเทศ (นานาชาติ)', 26, false, NOW(), NOW()),
        (102, '03-28-01', 'วิทยาศาสตร์ทางทะเลและการจัดการชายฝั่ง', 27, false, NOW(), NOW()),
        (103, '03-28-02', 'วิทยาศาสตร์และเทคโนโลยีสิ่งแวดล้อม', 27, false, NOW(), NOW()),
        (104, '03-29-01', 'การคอมพิวเตอร์', 28, true, NOW(), NOW()),
        (105, '03-29-02', 'วิศวกรรมดิจิทัล (นานาชาติ)', 28, true, NOW(), NOW()),
        (106, '03-29-03', 'ธุรกิจดิจิทัล (นานาชาติ)', 28, false, NOW(), NOW()),
        (107, '03-29-04', 'วิศวกรรมปัญญาประดิษฐ์และระบบอัจฉริยะ', 28, true, NOW(), NOW()),
        (108, '04-30-01', 'เทคโนโลยีสารสนเทศ', 29, true, NOW(), NOW()),
        (109, '04-30-02', 'เคมีเพื่ออุตสาหกรรม', 29, false, NOW(), NOW()),
        (110, '04-30-03', 'การจัดการนวัตกรรมการค้าสมัยใหม่', 29, false, NOW(), NOW()),
        (111, '04-30-04', 'เทคโนโลยีการจัดการสิ่งแวดล้อม', 29, false, NOW(), NOW()),
        (112, '04-30-05', 'อาชีวอนามัยและความปลอดภัย', 29, false, NOW(), NOW()),
        (113, '04-30-06', 'การจัดการอุตสาหกรรมยาง', 29, false, NOW(), NOW()),
        (114, '04-30-07', 'วิศวกรรมอุตสาหการและการจัดการ', 29, false, NOW(), NOW()),
        (115, '04-30-08', 'เทคโนโลยีและการพัฒนาผลิตภัณฑ์ไม้', 29, false, NOW(), NOW()),
        (116, '04-31-01', 'การจัดการธุรกิจการท่องเที่ยว', 30, false, NOW(), NOW()),
        (117, '04-31-02', 'การบัญชี', 30, false, NOW(), NOW()),
        (118, '04-31-03', 'การจัดการธุรกิจ', 30, false, NOW(), NOW()),
        (119, '04-31-04', 'เศรษฐศาสตร์ธุรกิจ', 30, false, NOW(), NOW()),
        (120, '04-31-05', 'ภาษาจีนเพื่อการสื่อสารทางธุรกิจ (นานาชาติ)', 30, false, NOW(), NOW()),
        (121, '04-31-06', 'ภาษาอังกฤษเพื่อการสื่อสารทางธุรกิจ', 30, false, NOW(), NOW()),
        (122, '04-31-07', 'การจัดการรัฐกิจ', 30, false, NOW(), NOW()),
        (123, '04-33-01', 'วิทยาศาสตร์และเทคโนโลยีการเกษตร', 31, false, NOW(), NOW()),
        (124, '04-33-02', 'ทรัพยากรประมง', 31, false, NOW(), NOW()),
        (125, '04-33-03', 'เทคโนโลยีอาหาร', 31, false, NOW(), NOW()),
        (126, '05-34-01', 'การจัดการการท่องเที่ยวและการโรงแรม', 32, false, NOW(), NOW()),
        (127, '05-34-02', 'การบัญชี', 32, false, NOW(), NOW()),
        (128, '05-34-03', 'การตลาด', 32, false, NOW(), NOW()),
        (129, '05-34-04', 'เทคโนโลยีสารสนเทศทางธุรกิจ (ธุรกิจดิจิทัล)', 32, false, NOW(), NOW()),
        (130, '05-34-05', 'การบริหารธุรกิจประกันภัยและการจัดการความเสี่ยง', 32, false, NOW(), NOW()),
        (131, '05-34-06', 'เทคโนโลยีสารสนเทศทางธุรกิจ (การจัดการสารสนเทศและเทคโนโลยีดิจิทัล)', 32, false, NOW(), NOW()),
        (132, '05-34-07', 'ภาษาอังกฤษธุรกิจ', 32, false, NOW(), NOW()),
        (133, '05-34-08', 'การจัดการรัฐกิจ', 32, false, NOW(), NOW()),
        (134, '05-35-01', 'สถาปัตยกรรม', 33, false, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "majorId" = EXCLUDED."majorId",
        "major" = EXCLUDED."major",
        "facultyId" = EXCLUDED."facultyId",
        "isAboutCs" = EXCLUDED."isAboutCs",
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
