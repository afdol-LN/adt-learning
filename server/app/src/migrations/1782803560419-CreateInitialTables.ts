import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialTables1782803560419 implements MigrationInterface {
    name = 'CreateInitialTables1782803560419'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "gender" ("id" SERIAL NOT NULL, "gender" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_98a711129bc073e6312d08364e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "campus" ("id" SERIAL NOT NULL, "campus" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_150aa1747b3517c47f9bd98ea6d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "faculty" ("id" SERIAL NOT NULL, "faculty" character varying NOT NULL, "campusId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "REL_462289c7845fba8356017318f7" UNIQUE ("campusId"), CONSTRAINT "PK_635ca3484f9c747b6635a494ad9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "major" ("id" SERIAL NOT NULL, "major" character varying NOT NULL, "facultyId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "REL_ac4bdd43e2f613aca140c937fb" UNIQUE ("facultyId"), CONSTRAINT "PK_00341ff87e17ae50751c5da05ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."userprofile_role_enum" AS ENUM('admin', 'user')`);
        await queryRunner.query(`CREATE TABLE "userprofile" ("id" SERIAL NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "genderId" integer NOT NULL, "birthDate" character varying NOT NULL, "campusId" integer NOT NULL, "facultyId" integer NOT NULL, "majorId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "role" "public"."userprofile_role_enum" NOT NULL DEFAULT 'user', CONSTRAINT "REL_44c83d58803b1edafd245e1471" UNIQUE ("genderId"), CONSTRAINT "REL_e270ac3a7edce90f113f77b78a" UNIQUE ("campusId"), CONSTRAINT "REL_d11492054b4aabfbab8cb3045b" UNIQUE ("facultyId"), CONSTRAINT "REL_aa1ff8b13d8e063f8e9de9a49e" UNIQUE ("majorId"), CONSTRAINT "PK_7611eb6ce0cfd2de134000d0b8f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "goal" ("id" SERIAL NOT NULL, "goal" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_88c8e2b461b711336c836b1e130" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "branch" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "goalId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, CONSTRAINT "REL_f969fd357b4491268a4520e8a0" UNIQUE ("userId"), CONSTRAINT "REL_e6aa5e90fc6f46e5a6ef66a3ea" UNIQUE ("goalId"), CONSTRAINT "PK_2e39f426e2faefdaa93c5961976" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessionExcercise" ("id" SERIAL NOT NULL, CONSTRAINT "PK_3b41efd64df03e82c9274cd9898" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."exercise_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "exercise" ("id" SERIAL NOT NULL, "description" character varying NOT NULL, "level" integer NOT NULL, "status" "public"."exercise_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0f107e3a2ef2742c1e91d97c14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exerciseChoice" ("id" SERIAL NOT NULL, "isAnswer" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "exerciseId" integer, CONSTRAINT "REL_844b1a843ec0efffd77b293a0e" UNIQUE ("exerciseId"), CONSTRAINT "PK_e88943facf79c0f5daf47a5e28d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session_excercise_exercises_exercise" ("sessionExcerciseId" integer NOT NULL, "exerciseId" integer NOT NULL, CONSTRAINT "PK_b4dfc1f5e40e0f21817e71e7ec0" PRIMARY KEY ("sessionExcerciseId", "exerciseId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f9b60dd8b013aedc7d39e37efe" ON "session_excercise_exercises_exercise"  ("sessionExcerciseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_408bea27e7252cef96ac54f201" ON "session_excercise_exercises_exercise"  ("exerciseId") `);
        await queryRunner.query(`ALTER TABLE "faculty" ADD CONSTRAINT "FK_462289c7845fba8356017318f71" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "major" ADD CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userprofile" ADD CONSTRAINT "FK_44c83d58803b1edafd245e14713" FOREIGN KEY ("genderId") REFERENCES "gender"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userprofile" ADD CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userprofile" ADD CONSTRAINT "FK_d11492054b4aabfbab8cb3045be" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userprofile" ADD CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5" FOREIGN KEY ("majorId") REFERENCES "major"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branch" ADD CONSTRAINT "FK_f969fd357b4491268a4520e8a07" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branch" ADD CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exerciseChoice" ADD CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session_excercise_exercises_exercise" ADD CONSTRAINT "FK_f9b60dd8b013aedc7d39e37efee" FOREIGN KEY ("sessionExcerciseId") REFERENCES "sessionExcercise"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "session_excercise_exercises_exercise" ADD CONSTRAINT "FK_408bea27e7252cef96ac54f201d" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session_excercise_exercises_exercise" DROP CONSTRAINT "FK_408bea27e7252cef96ac54f201d"`);
        await queryRunner.query(`ALTER TABLE "session_excercise_exercises_exercise" DROP CONSTRAINT "FK_f9b60dd8b013aedc7d39e37efee"`);
        await queryRunner.query(`ALTER TABLE "exerciseChoice" DROP CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed"`);
        await queryRunner.query(`ALTER TABLE "branch" DROP CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae"`);
        await queryRunner.query(`ALTER TABLE "branch" DROP CONSTRAINT "FK_f969fd357b4491268a4520e8a07"`);
        await queryRunner.query(`ALTER TABLE "userprofile" DROP CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5"`);
        await queryRunner.query(`ALTER TABLE "userprofile" DROP CONSTRAINT "FK_d11492054b4aabfbab8cb3045be"`);
        await queryRunner.query(`ALTER TABLE "userprofile" DROP CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4"`);
        await queryRunner.query(`ALTER TABLE "userprofile" DROP CONSTRAINT "FK_44c83d58803b1edafd245e14713"`);
        await queryRunner.query(`ALTER TABLE "major" DROP CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe"`);
        await queryRunner.query(`ALTER TABLE "faculty" DROP CONSTRAINT "FK_462289c7845fba8356017318f71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_408bea27e7252cef96ac54f201"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9b60dd8b013aedc7d39e37efe"`);
        await queryRunner.query(`DROP TABLE "session_excercise_exercises_exercise"`);
        await queryRunner.query(`DROP TABLE "exerciseChoice"`);
        await queryRunner.query(`DROP TABLE "exercise"`);
        await queryRunner.query(`DROP TYPE "public"."exercise_status_enum"`);
        await queryRunner.query(`DROP TABLE "sessionExcercise"`);
        await queryRunner.query(`DROP TABLE "branch"`);
        await queryRunner.query(`DROP TABLE "goal"`);
        await queryRunner.query(`DROP TABLE "userprofile"`);
        await queryRunner.query(`DROP TYPE "public"."userprofile_role_enum"`);
        await queryRunner.query(`DROP TABLE "major"`);
        await queryRunner.query(`DROP TABLE "faculty"`);
        await queryRunner.query(`DROP TABLE "campus"`);
        await queryRunner.query(`DROP TABLE "gender"`);
    }

}
