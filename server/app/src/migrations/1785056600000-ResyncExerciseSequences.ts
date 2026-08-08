import { MigrationInterface, QueryRunner } from 'typeorm';

// The exercise/exerciseChoice seed data (src/seeds/master-data.seed.ts) inserts rows
// with explicit "id" values via raw SQL, which does not advance the table's identity
// sequence. Any subsequent insert through TypeORM (e.g. POST /exercise) then collides
// with an already-seeded id. This resyncs both sequences to the current max(id).
export class ResyncExerciseSequences1785056600000 implements MigrationInterface {
  name = 'ResyncExerciseSequences1785056600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `SELECT setval('exercise_id_seq', (SELECT COALESCE(MAX(id), 1) FROM "exercise"))`,
    );
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('"exerciseChoice"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "exerciseChoice"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: resyncing a sequence forward is not reversible in a meaningful way.
  }
}
