import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1783606369918 implements MigrationInterface {
  name = 'UpdateSchem1783606369918';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "password" TYPE character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT IF EXISTS "REL_44c83d58803b1edafd245e1471"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT IF EXISTS "REL_e270ac3a7edce90f113f77b78a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT IF EXISTS "REL_d11492054b4aabfbab8cb3045b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT IF EXISTS "REL_aa1ff8b13d8e063f8e9de9a49e"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_44c83d58803b1edafd245e1471" UNIQUE ("genderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_e270ac3a7edce90f113f77b78a" UNIQUE ("campusId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_d11492054b4aabfbab8cb3045b" UNIQUE ("facultyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_aa1ff8b13d8e063f8e9de9a49e" UNIQUE ("majorId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "password" TYPE character varying(20)`,
    );
  }
}
