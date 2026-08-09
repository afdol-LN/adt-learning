import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionLoopColumns1786200000000
  implements MigrationInterface
{
  name = 'AddSessionLoopColumns1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" ADD "branchId" integer`);
    await queryRunner.query(`ALTER TABLE "session" ADD "skillId" integer`);
    await queryRunner.query(`ALTER TABLE "session" ADD "endedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "session" ADD "stopReason" varchar`);
    await queryRunner.query(
      `ALTER TABLE "history" ADD "pL" double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "history" DROP COLUMN "pL"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "stopReason"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "endedAt"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "skillId"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "branchId"`);
  }
}
