import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1785569767475 implements MigrationInterface {
  name = 'UpdateSchem1785569767475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "userprofile" ADD "year" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "year"`);
  }
}
