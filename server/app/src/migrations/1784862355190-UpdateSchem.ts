import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1784862355190 implements MigrationInterface {
  name = 'UpdateSchem1784862355190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill" ADD "skillCode" character varying`,
    );
    await queryRunner.query(
      `UPDATE "skill" SET "skillCode" = UPPER(REGEXP_REPLACE("skills_name", '[^a-zA-Z0-9]', '', 'g')) WHERE "skillCode" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill" ALTER COLUMN "skillCode" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill" ADD CONSTRAINT "UQ_a36c25f4a6a10500e264d263822" UNIQUE ("skillCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill" DROP CONSTRAINT "UQ_a36c25f4a6a10500e264d263822"`,
    );
    await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "skillCode"`);
  }
}
