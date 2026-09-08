import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConceptMapStateToBranch1789100000000
  implements MigrationInterface
{
  name = 'AddConceptMapStateToBranch1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branch" ADD "conceptMapState" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch" DROP COLUMN "conceptMapState"`,
    );
  }
}
