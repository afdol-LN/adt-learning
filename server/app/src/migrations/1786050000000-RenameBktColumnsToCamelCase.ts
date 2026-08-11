import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBktColumnsToCamelCase1786050000000 implements MigrationInterface {
  name = 'RenameBktColumnsToCamelCase1786050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill" RENAME COLUMN "p_l_0" TO "pL0"`,
    );
    await queryRunner.query(`ALTER TABLE "skill" RENAME COLUMN "p_t" TO "pT"`);
    await queryRunner.query(
      `ALTER TABLE "exercise" RENAME COLUMN "p_g" TO "pG"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" RENAME COLUMN "p_s" TO "pS"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise" RENAME COLUMN "pS" TO "p_s"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" RENAME COLUMN "pG" TO "p_g"`,
    );
    await queryRunner.query(`ALTER TABLE "skill" RENAME COLUMN "pT" TO "p_t"`);
    await queryRunner.query(
      `ALTER TABLE "skill" RENAME COLUMN "pL0" TO "p_l_0"`,
    );
  }
}
