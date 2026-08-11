import { MigrationInterface, QueryRunner } from 'typeorm';
import { DifficultySeed } from '../libs/bkt/questionSelection';
import { ExerciseType } from '../enums/exercise-type.enum';

export class SeedDifficultyParameters1786100000000 implements MigrationInterface {
  name = 'SeedDifficultyParameters1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE skill SET "pT" = 0.10 WHERE "pT" IS NULL`);

    const exercises: { id: number; level: number; type: string }[] =
      await queryRunner.query(`SELECT id, level, type FROM exercise`);

    for (const exercise of exercises) {
      const choiceCountRows: { count: string }[] = await queryRunner.query(
        `SELECT COUNT(*)::text AS count FROM "exerciseChoice" WHERE "exerciseId" = $1`,
        [exercise.id],
      );
      const nChoices = Number(choiceCountRows[0]?.count ?? 0);
      const pS = DifficultySeed.seedPS(exercise.level);
      const pG = DifficultySeed.seedPG(
        exercise.type as ExerciseType,
        exercise.level,
        nChoices || 4,
      );
      await queryRunner.query(
        `UPDATE exercise SET "pG" = $1, "pS" = $2 WHERE id = $3`,
        [pG, pS, exercise.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE exercise SET "pG" = 0.1, "pS" = 0.1`);
  }
}
