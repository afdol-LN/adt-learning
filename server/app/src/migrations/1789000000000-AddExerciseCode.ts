import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExerciseCode1789000000000 implements MigrationInterface {
  name = 'AddExerciseCode1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // โค้ดที่นักศึกษาต้องอ่านก่อนตอบ แยกจาก description เพราะ description
    // ถูก render เป็นข้อความธรรมดา ขึ้นบรรทัดใหม่และเว้นวรรคจะหายหมด
    await queryRunner.query(`ALTER TABLE "exercise" ADD "code" text`);
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD "language" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "language"`);
    await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "code"`);
  }
}
