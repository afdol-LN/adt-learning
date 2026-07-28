import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExerciseSkillLevelAndType1784470000000 implements MigrationInterface {
    name = 'AddExerciseSkillLevelAndType1784470000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exercise" ADD "skill_level" integer`);
        await queryRunner.query(`UPDATE "exercise" SET "skill_level" = "level" WHERE "skill_level" IS NULL`);
        await queryRunner.query(`ALTER TABLE "exercise" ALTER COLUMN "skill_level" SET NOT NULL`);

        await queryRunner.query(`CREATE TYPE "public"."exercise_type_enum" AS ENUM('CHOICE', 'FILL_IN_BLANK')`);
        await queryRunner.query(`ALTER TABLE "exercise" ADD "type" "public"."exercise_type_enum" NOT NULL DEFAULT 'CHOICE'`);
        await queryRunner.query(`UPDATE "exercise" SET "type" = 'FILL_IN_BLANK' WHERE "fillInBlank" IS NOT NULL AND trim("fillInBlank") <> ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."exercise_type_enum"`);
        await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "skill_level"`);
    }

}
