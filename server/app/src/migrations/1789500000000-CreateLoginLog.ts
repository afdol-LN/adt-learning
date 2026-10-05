import { MigrationInterface, QueryRunner } from 'typeorm';

// admin activity timeline: login events had no record anywhere before this table
export class CreateLoginLog1789500000000 implements MigrationInterface {
  name = 'CreateLoginLog1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "loginLog" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "loggedInAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_loginLog_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loginLog_userId" ON "loginLog" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loginLog_loggedInAt" ON "loginLog" ("loggedInAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "loginLog" ADD CONSTRAINT "FK_loginLog_userId" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loginLog" DROP CONSTRAINT "FK_loginLog_userId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_loginLog_loggedInAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_loginLog_userId"`);
    await queryRunner.query(`DROP TABLE "loginLog"`);
  }
}
