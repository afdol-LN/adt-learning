import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1785663867996 implements MigrationInterface {
  name = 'UpdateSchem1785663867996';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" ADD "chosenAnswer" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "history" DROP COLUMN "chosenAnswer"`);
  }
}
