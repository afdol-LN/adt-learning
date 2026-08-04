import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSchem1785818470373 implements MigrationInterface {
    name = 'UpdateSchem1785818470373'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill" ADD "p_l_0" double precision NOT NULL DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "skill" ADD "p_t" double precision NOT NULL DEFAULT '0.1'`);
        await queryRunner.query(`ALTER TABLE "exercise" ADD "p_g" double precision NOT NULL DEFAULT '0.1'`);
        await queryRunner.query(`ALTER TABLE "exercise" ADD "p_s" double precision NOT NULL DEFAULT '0.1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "p_s"`);
        await queryRunner.query(`ALTER TABLE "exercise" DROP COLUMN "p_g"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "p_t"`);
        await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "p_l_0"`);
    }

}
