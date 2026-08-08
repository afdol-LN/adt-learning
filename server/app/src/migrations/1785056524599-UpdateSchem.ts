import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1785056524599 implements MigrationInterface {
  name = 'UpdateSchem1785056524599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill" ALTER COLUMN "tier" TYPE character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill" ALTER COLUMN "tier" TYPE character varying(1)`,
    );
  }
}
