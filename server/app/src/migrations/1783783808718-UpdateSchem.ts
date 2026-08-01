import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1783783808718 implements MigrationInterface {
  name = 'UpdateSchem1783783808718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise" DROP CONSTRAINT "FK_4d606e0535d4660e72378ee51c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ALTER COLUMN "skill_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise" DROP CONSTRAINT "FK_4d606e0535d4660e72378ee51c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ALTER COLUMN "skill_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise" ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "skill"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
