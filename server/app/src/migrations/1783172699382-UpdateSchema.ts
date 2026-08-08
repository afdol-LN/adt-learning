import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchema1783172699382 implements MigrationInterface {
  name = 'UpdateSchema1783172699382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "session" ("session_id" SERIAL NOT NULL, "num_of_exercise" integer, "create_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ba62b11184a8d3312278d4d1ac" PRIMARY KEY ("session_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "skill" ("skill_id" integer NOT NULL, "skills_name" character varying(30) NOT NULL, "tier" character varying(1), "status" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_9ad49f5c60b5cfd0c7bd4fe87a4" PRIMARY KEY ("skill_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "GoalskillRequire" ("goal_id" integer NOT NULL, "skill_id" integer NOT NULL, "level_require" integer, CONSTRAINT "PK_c9a4e8037ca1fc72e1fde3d6932" PRIMARY KEY ("goal_id", "skill_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "skills_prerequisite" ("skill_id" integer NOT NULL, "prerequisite_skill" integer NOT NULL, "Prerequisite_level" integer, CONSTRAINT "PK_9871929a234489a25c79c59881c" PRIMARY KEY ("skill_id", "prerequisite_skill"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "exercise_session" ("session_id" integer NOT NULL, "exercise_id" integer NOT NULL, CONSTRAINT "PK_880463192f1f9705afa5e2c5cf5" PRIMARY KEY ("session_id", "exercise_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03dcc399e441f687b42468fcce" ON "exercise_session"  ("session_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29f8d8ee6bf309d2407f64f0bb" ON "exercise_session"  ("exercise_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "username" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "password" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "status" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "behaviorScore" numeric(4,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "conceptMapState" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "strengthWeaknessMatrix" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ADD "goal_name" character varying(20)`,
    );
    await queryRunner.query(`ALTER TABLE "branch" ADD "exp_for_goal" integer`);
    await queryRunner.query(`ALTER TABLE "exercise" ADD "expect_time" integer`);
    await queryRunner.query(`ALTER TABLE "exercise" ADD "skill_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD "choice_NO" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD "script" character varying(15)`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "goal" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP CONSTRAINT "REL_844b1a843ec0efffd77b293a0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GoalskillRequire" ADD CONSTRAINT "FK_55f3d243ed490d95ac2ae555293" FOREIGN KEY ("goal_id") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GoalskillRequire" ADD CONSTRAINT "FK_1103603a537595a59e13d330bdc" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_37576f552aa89a3499312d86785" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_9051a94500517a33b1454f0b8df" FOREIGN KEY ("prerequisite_skill") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_session" ADD CONSTRAINT "FK_03dcc399e441f687b42468fcce8" FOREIGN KEY ("session_id") REFERENCES "session"("session_id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_session" ADD CONSTRAINT "FK_29f8d8ee6bf309d2407f64f0bb7" FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise_session" DROP CONSTRAINT "FK_29f8d8ee6bf309d2407f64f0bb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_session" DROP CONSTRAINT "FK_03dcc399e441f687b42468fcce8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_9051a94500517a33b1454f0b8df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_37576f552aa89a3499312d86785"`,
    );
    await queryRunner.query(
      `ALTER TABLE "GoalskillRequire" DROP CONSTRAINT "FK_1103603a537595a59e13d330bdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "GoalskillRequire" DROP CONSTRAINT "FK_55f3d243ed490d95ac2ae555293"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" DROP CONSTRAINT "FK_4d606e0535d4660e72378ee51c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD CONSTRAINT "REL_844b1a843ec0efffd77b293a0e" UNIQUE ("exerciseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" ADD CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ALTER COLUMN "updatedAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "updatedAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "goal" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" ALTER COLUMN "updatedAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "campus" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP COLUMN "script"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exerciseChoice" DROP COLUMN "choice_NO"`,
    );
    await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "skill_id"`);
    await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "expect_time"`);
    await queryRunner.query(`ALTER TABLE "branch" DROP COLUMN "exp_for_goal"`);
    await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "goal_name"`);
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "strengthWeaknessMatrix"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "conceptMapState"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "behaviorScore"`,
    );
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "username"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29f8d8ee6bf309d2407f64f0bb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03dcc399e441f687b42468fcce"`,
    );
    await queryRunner.query(`DROP TABLE "exercise_session"`);
    await queryRunner.query(`DROP TABLE "skills_prerequisite"`);
    await queryRunner.query(`DROP TABLE "GoalskillRequire"`);
    await queryRunner.query(`DROP TABLE "skill"`);
    await queryRunner.query(`DROP TABLE "session"`);
  }
}
