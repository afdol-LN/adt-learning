import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1783951604521 implements MigrationInterface {
  name = 'UpdateSchem1783951604521';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" RENAME COLUMN "session_id" TO "id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" RENAME CONSTRAINT "PK_370970eadd0593d5e83fb008665" TO "PK_64c310cf8715d77e3a09cada1bc"`,
    );
    await queryRunner.query(
      `ALTER SEQUENCE "sessionAndExercise_session_id_seq" RENAME TO "sessionAndExercise_id_seq"`,
    );
    await queryRunner.query(
      `CREATE TABLE "history" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "sessionAndExerciseId" integer NOT NULL, "isCorrect" boolean NOT NULL DEFAULT false, "isPretest" boolean NOT NULL DEFAULT false, "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9384942edf4804b38ca0ee51416" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d339708f0fa8446e3c4128dea" ON "history"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e186da3fbc4e778e129595d2e0" ON "history"  ("sessionAndExerciseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_943f1e701505b2c3a2768c8cd7" ON "sessionAndExercise"  ("exerciseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b403df1cd6c12e25fc6ed36b6" ON "sessionAndExercise"  ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8b144ec75b276a19f69b60f12" ON "exercise"  ("level") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d606e0535d4660e72378ee51c" ON "exercise"  ("skill_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_7d339708f0fa8446e3c4128dea9" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_e186da3fbc4e778e129595d2e06" FOREIGN KEY ("sessionAndExerciseId") REFERENCES "sessionAndExercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_e186da3fbc4e778e129595d2e06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_7d339708f0fa8446e3c4128dea9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d606e0535d4660e72378ee51c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8b144ec75b276a19f69b60f12"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9b403df1cd6c12e25fc6ed36b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_943f1e701505b2c3a2768c8cd7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e186da3fbc4e778e129595d2e0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d339708f0fa8446e3c4128dea"`,
    );
    await queryRunner.query(`DROP TABLE "history"`);
    await queryRunner.query(
      `ALTER SEQUENCE "sessionAndExercise_id_seq" RENAME TO "sessionAndExercise_session_id_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" RENAME CONSTRAINT "PK_64c310cf8715d77e3a09cada1bc" TO "PK_370970eadd0593d5e83fb008665"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessionAndExercise" RENAME COLUMN "id" TO "session_id"`,
    );
  }
}
