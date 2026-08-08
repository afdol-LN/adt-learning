import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1786018681156 implements MigrationInterface {
  name = 'UpdateSchem1786018681156';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "major" ADD "isAboutCs" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "major" DROP COLUMN "isAboutCs"`);
  }
}
