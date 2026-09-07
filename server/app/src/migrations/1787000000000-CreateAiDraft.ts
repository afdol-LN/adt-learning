import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiDraft1787000000000 implements MigrationInterface {
  name = 'CreateAiDraft1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."aiDraft_entity_type_enum" AS ENUM('exercise', 'skill', 'goal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."aiDraft_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(`
      CREATE TABLE "aiDraft" (
        "id" SERIAL NOT NULL,
        "batch_id" character varying(36) NOT NULL,
        "entity_type" "public"."aiDraft_entity_type_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."aiDraft_status_enum" NOT NULL DEFAULT 'pending',
        "prompt" text,
        "generate_params" jsonb,
        "model" character varying(120),
        "created_by" integer,
        "approved_entity_id" integer,
        "note" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_aiDraft_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_aiDraft_batch_id" ON "aiDraft" ("batch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aiDraft_entity_type" ON "aiDraft" ("entity_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aiDraft_status" ON "aiDraft" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_aiDraft_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aiDraft_entity_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aiDraft_batch_id"`);
    await queryRunner.query(`DROP TABLE "aiDraft"`);
    await queryRunner.query(`DROP TYPE "public"."aiDraft_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."aiDraft_entity_type_enum"`);
  }
}
