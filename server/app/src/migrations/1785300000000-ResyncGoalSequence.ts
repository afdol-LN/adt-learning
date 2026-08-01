import { MigrationInterface, QueryRunner } from 'typeorm';

// The goal seed data (src/seeds/master-data.seed.ts) inserts rows with explicit
// "id" values via raw SQL, which does not advance the table's identity sequence.
// Any subsequent insert through TypeORM (e.g. POST /goal/with-skill-require) then
// collides with an already-seeded id. This resyncs the sequence to the current
// max(id), mirroring ResyncExerciseSequences1785056600000.
export class ResyncGoalSequence1785300000000 implements MigrationInterface {
  name = 'ResyncGoalSequence1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `SELECT setval('goal_id_seq', (SELECT COALESCE(MAX(id), 1) FROM "goal"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: resyncing a sequence forward is not reversible in a meaningful way.
  }
}
