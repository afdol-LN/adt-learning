import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/adr/0005: the first time a branch completes its goal is recorded, and it stays complete
export class AddGoalCompletedAtToBranch1789300000000
  implements MigrationInterface
{
  name = 'AddGoalCompletedAtToBranch1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch" ADD "goalCompletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch" DROP COLUMN "goalCompletedAt"`,
    );
  }
}
