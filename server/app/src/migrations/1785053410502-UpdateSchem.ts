import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSchem1785053410502 implements MigrationInterface {
    name = 'UpdateSchem1785053410502'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "GoalskillRequire" DROP CONSTRAINT "FK_1103603a537595a59e13d330bdc"`);
        await queryRunner.query(`ALTER TABLE "exercise" DROP CONSTRAINT "FK_4d606e0535d4660e72378ee51c7"`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_37576f552aa89a3499312d86785"`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_9051a94500517a33b1454f0b8df"`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "skill_skill_id_seq" OWNED BY "skill"."skill_id"`);
        await queryRunner.query(`ALTER TABLE "skill" ALTER COLUMN "skill_id" SET DEFAULT nextval('"skill_skill_id_seq"')`);
        await queryRunner.query(`SELECT setval('"skill_skill_id_seq"', COALESCE((SELECT MAX("skill_id") FROM "skill"), 0) + 1, false)`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_37576f552aa89a3499312d86785" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_9051a94500517a33b1454f0b8df" FOREIGN KEY ("prerequisite_skill") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exercise" ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "GoalskillRequire" ADD CONSTRAINT "FK_1103603a537595a59e13d330bdc" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "GoalskillRequire" DROP CONSTRAINT "FK_1103603a537595a59e13d330bdc"`);
        await queryRunner.query(`ALTER TABLE "exercise" DROP CONSTRAINT "FK_4d606e0535d4660e72378ee51c7"`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_9051a94500517a33b1454f0b8df"`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" DROP CONSTRAINT "FK_37576f552aa89a3499312d86785"`);
        await queryRunner.query(`ALTER TABLE "skill" ALTER COLUMN "skill_id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "skill_skill_id_seq"`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_9051a94500517a33b1454f0b8df" FOREIGN KEY ("prerequisite_skill") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills_prerequisite" ADD CONSTRAINT "FK_37576f552aa89a3499312d86785" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exercise" ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "GoalskillRequire" ADD CONSTRAINT "FK_1103603a537595a59e13d330bdc" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
