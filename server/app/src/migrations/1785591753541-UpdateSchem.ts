import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSchem1785591753541 implements MigrationInterface {
    name = 'UpdateSchem1785591753541'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exerciseChoice" DROP COLUMN "script"`);
        await queryRunner.query(`ALTER TABLE "exerciseChoice" ADD "script" character varying(80)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exerciseChoice" DROP COLUMN "script"`);
        await queryRunner.query(`ALTER TABLE "exerciseChoice" ADD "script" character varying(15)`);
    }

}
