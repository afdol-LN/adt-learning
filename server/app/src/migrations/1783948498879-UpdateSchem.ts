import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1783948498879 implements MigrationInterface {
  name = 'UpdateSchem1783948498879';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sessionAndExercise" ("session_id" SERIAL NOT NULL, "exerciseId" integer NOT NULL, "sessionId" integer NOT NULL, CONSTRAINT "PK_370970eadd0593d5e83fb008665" PRIMARY KEY ("session_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" DROP COLUMN "num_of_exercise"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP COLUMN "choice_NO"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD "fillInBlank" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD "isCasesensitive" character varying DEFAULT 'NO'`,
    );
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."userprofile_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "status" "public"."userprofile_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."skill_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill" ADD "status" "public"."skill_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" ADD CONSTRAINT "FK_943f1e701505b2c3a2768c8cd77" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" ADD CONSTRAINT "FK_9b403df1cd6c12e25fc6ed36b63" FOREIGN KEY ("sessionId") REFERENCES "session"("session_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" DROP CONSTRAINT "FK_9b403df1cd6c12e25fc6ed36b63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" DROP CONSTRAINT "FK_943f1e701505b2c3a2768c8cd77"`,
    );
    await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."skill_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "skill" ADD "status" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."userprofile_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "status" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" DROP COLUMN "isCasesensitive"`,
    );
    await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "fillInBlank"`);
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD "choice_NO" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD "num_of_exercise" integer`,
    );
    await queryRunner.query(`DROP TABLE "sessionAndExercise"`);
  }
}
