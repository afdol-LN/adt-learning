import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSchem1786455047023 implements MigrationInterface {
    name = 'UpdateSchem1786455047023'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "userprofile" ADD "isEverTour" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "FK_e21b828aabfcb00966b88118e2c" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "FK_d352d1ff0a85e7c48ddd45a772c" FOREIGN KEY ("skillId") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_d352d1ff0a85e7c48ddd45a772c"`);
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_e21b828aabfcb00966b88118e2c"`);
        await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "isEverTour"`);
    }

}
