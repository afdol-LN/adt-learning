import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoalStatusAndDescription1785200000000 implements MigrationInterface {
  name = 'AddGoalStatusAndDescription1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal" RENAME COLUMN "goal_name" TO "goal_description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "goal_description" TYPE character varying(255)`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."goal_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" ADD "status" "public"."goal_status_enum" NOT NULL DEFAULT 'active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."goal_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "goal" ALTER COLUMN "goal_description" TYPE character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal" RENAME COLUMN "goal_description" TO "goal_name"`,
    );
  }
}
