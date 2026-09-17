import { MigrationInterface, QueryRunner } from 'typeorm';

// ร่าง exercise จาก AI บอกว่าคล้ายโจทย์เดิมข้อไหนกี่เปอร์เซ็นต์ — เก็บแยกจาก payload
// เพราะ payload ต้องตรงกับ CreateExerciseDto ที่ส่งต่อให้ exerciseService ตอน approve
export class AddSimilarityToAiDraft1789400000000 implements MigrationInterface {
  name = 'AddSimilarityToAiDraft1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "aiDraft" ADD "similarity" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "aiDraft" DROP COLUMN "similarity"`);
  }
}
