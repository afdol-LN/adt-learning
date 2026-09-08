import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropConceptMapStateFromUserprofile1789200000000
  implements MigrationInterface
{
  name = 'DropConceptMapStateFromUserprofile1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "conceptMapState"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores the column shape only; the per-branch data in
    // branch."conceptMapState" is authoritative and is not copied back.
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "conceptMapState" jsonb`,
    );
  }
}
