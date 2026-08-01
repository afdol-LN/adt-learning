import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1784294789005 implements MigrationInterface {
  name = 'UpdateSchem1784294789005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "faculty" RENAME COLUMN "faculty_id" TO "facultyId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" RENAME COLUMN "campus_id" TO "campusId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" ADD "majorId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" ADD CONSTRAINT "UQ_47e1c8a19666fc7ba8e94ff9c12" UNIQUE ("majorId")`,
    );
    await queryRunner.query(`ALTER TABLE "faculty" DROP COLUMN "facultyId"`);
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD "facultyId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD CONSTRAINT "UQ_dc61338eeb239be5c072b974bc0" UNIQUE ("facultyId")`,
    );
    await queryRunner.query(`ALTER TABLE "campus" DROP COLUMN "campusId"`);
    await queryRunner.query(
      `ALTER TABLE "campus" ADD "campusId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" ADD CONSTRAINT "UQ_43400407f9d1a0498c3dc0ecc45" UNIQUE ("campusId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campus" DROP CONSTRAINT "UQ_43400407f9d1a0498c3dc0ecc45"`,
    );
    await queryRunner.query(`ALTER TABLE "campus" DROP COLUMN "campusId"`);
    await queryRunner.query(
      `ALTER TABLE "campus" ADD "campusId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" DROP CONSTRAINT "UQ_dc61338eeb239be5c072b974bc0"`,
    );
    await queryRunner.query(`ALTER TABLE "faculty" DROP COLUMN "facultyId"`);
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD "facultyId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" DROP CONSTRAINT "UQ_47e1c8a19666fc7ba8e94ff9c12"`,
    );
    await queryRunner.query(`ALTER TABLE "major" DROP COLUMN "majorId"`);
    await queryRunner.query(
      `ALTER TABLE "campus" RENAME COLUMN "campusId" TO "campus_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" RENAME COLUMN "facultyId" TO "faculty_id"`,
    );
  }
}
