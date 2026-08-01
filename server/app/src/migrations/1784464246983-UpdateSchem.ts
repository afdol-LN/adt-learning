import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1784464246983 implements MigrationInterface {
  name = 'UpdateSchem1784464246983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_7d339708f0fa8446e3c4128dea9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d339708f0fa8446e3c4128dea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" RENAME COLUMN "userId" TO "branchId"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e202b54d367400e0c24be6c80" ON "history"  ("branchId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_9e202b54d367400e0c24be6c807" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_9e202b54d367400e0c24be6c807"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e202b54d367400e0c24be6c80"`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" RENAME COLUMN "branchId" TO "userId"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d339708f0fa8446e3c4128dea" ON "history" USING btree ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_7d339708f0fa8446e3c4128dea9" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
