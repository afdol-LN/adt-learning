import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSchem1785583184408 implements MigrationInterface {
    name = 'UpdateSchem1785583184408'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branch" ADD "isAlreadyPretest" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branch" DROP COLUMN "isAlreadyPretest"`);
    }

}
