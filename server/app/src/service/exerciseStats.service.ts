import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from 'src/entity/history.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Skill } from 'src/entity/skill.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { MasteryState } from 'src/libs/bkt/masteryState';
import {
  ExerciseStatChoiceDto,
  ExerciseStatDetailDto,
  ExerciseStatStudentDto,
  ExerciseStatSummaryDto,
} from 'src/dto/exerciseStats.dto';

interface AnswerRow {
  id: number;
  isCorrect: boolean;
  isPretest: boolean;
  startTime: Date;
  endTime: Date;
  chosenAnswer: string | null;
  pL: number | null;
  exerciseId: number;
  userId: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class exerciseStatsService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Userprofile)
    private readonly userRepository: Repository<Userprofile>,
  ) {}

  // One query: every answer (oldest first) with the exercise and the student it belongs to.
  // Aggregation happens in memory so the DB is hit a fixed number of times (no N+1).
  private async loadAnswers(
    includePretest: boolean,
    exerciseId?: number,
    skillId?: number,
  ): Promise<AnswerRow[]> {
    const qb = this.historyRepository
      .createQueryBuilder('h')
      .innerJoin('h.sessionAndExercise', 'se')
      .innerJoin('h.branch', 'b')
      .select('h.id', 'id')
      .addSelect('h.isCorrect', 'isCorrect')
      .addSelect('h.isPretest', 'isPretest')
      .addSelect('h.startTime', 'startTime')
      .addSelect('h.endTime', 'endTime')
      .addSelect('h.chosenAnswer', 'chosenAnswer')
      .addSelect('h.pL', 'pL')
      .addSelect('se.exerciseId', 'exerciseId')
      .addSelect('b.userId', 'userId')
      .orderBy('h.id', 'ASC');

    if (!includePretest) qb.andWhere('h.isPretest = false');
    if (exerciseId !== undefined) {
      qb.andWhere('se.exerciseId = :exerciseId', { exerciseId });
    }
    if (skillId !== undefined) {
      qb.innerJoin(Exercise, 'ex', 'ex.id = se.exerciseId').andWhere(
        'ex.skillId = :skillId',
        { skillId },
      );
    }
    return await qb.getRawMany<AnswerRow>();
  }

  // group answers by exercise → by user (rows already in id ASC order)
  private groupByExerciseAndUser(
    rows: AnswerRow[],
  ): Map<number, Map<number, AnswerRow[]>> {
    const result = new Map<number, Map<number, AnswerRow[]>>();
    for (const row of rows) {
      let byUser = result.get(row.exerciseId);
      if (!byUser) {
        byUser = new Map();
        result.set(row.exerciseId, byUser);
      }
      const list = byUser.get(row.userId);
      if (list) list.push(row);
      else byUser.set(row.userId, [row]);
    }
    return result;
  }

  private summarize(
    exercise: Exercise,
    skillName: string,
    byUser: Map<number, AnswerRow[]> | undefined,
  ): ExerciseStatSummaryDto {
    let correct = 0;
    let wrong = 0;
    for (const attempts of byUser?.values() ?? []) {
      if (attempts[0].isCorrect) correct++;
      else wrong++;
    }
    const total = correct + wrong;
    return {
      exerciseId: exercise.id,
      description: (exercise.description ?? '').slice(0, 120),
      skillId: exercise.skillId,
      skillName,
      level: exercise.level,
      type: exercise.type,
      totalStudents: total,
      correctStudents: correct,
      wrongStudents: wrong,
      correctRate: total > 0 ? round1((correct / total) * 100) : null,
    };
  }

  async getList(
    skillId: number | undefined,
    includePretest: boolean,
  ): Promise<ExerciseStatSummaryDto[]> {
    const [exercises, skills, rows] = await Promise.all([
      this.exerciseRepository.find({
        where: skillId !== undefined ? { skillId } : {},
        order: { id: 'ASC' },
      }),
      this.skillRepository.find(),
      this.loadAnswers(includePretest, undefined, skillId),
    ]);
    const skillNames = new Map(skills.map((s) => [s.skillId, s.skillsName]));
    const grouped = this.groupByExerciseAndUser(rows);

    const list = exercises.map((e) =>
      this.summarize(e, skillNames.get(e.skillId) ?? '', grouped.get(e.id)),
    );
    // hardest first; questions nobody has answered go last
    return list.sort((a, b) => {
      if (a.correctRate === null && b.correctRate === null) return 0;
      if (a.correctRate === null) return 1;
      if (b.correctRate === null) return -1;
      return a.correctRate - b.correctRate;
    });
  }

  async getDetail(
    exerciseId: number,
    includePretest: boolean,
  ): Promise<ExerciseStatDetailDto> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: { exerciseChoices: true, skill: true },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise ${exerciseId} not found`);
    }

    const rows = await this.loadAnswers(includePretest, exerciseId);
    const byUser = this.groupByExerciseAndUser(rows).get(exerciseId);
    const summary = this.summarize(
      exercise,
      exercise.skill?.skillsName ?? '',
      byUser,
    );

    // names for the students who answered (one query)
    const userIds = Array.from(byUser?.keys() ?? []);
    const users = userIds.length
      ? await this.userRepository
          .createQueryBuilder('u')
          .select(['u.id', 'u.fullName'])
          .where('u.id IN (:...userIds)', { userIds })
          .getMany()
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));

    const students: ExerciseStatStudentDto[] = [];
    // first answers, for the choice-picked counts
    const firstAnswerCount = new Map<string, number>();

    for (const [userId, attempts] of byUser?.entries() ?? []) {
      const first = attempts[0];
      const last = attempts[attempts.length - 1];
      const durations = attempts
        .map(
          (a) =>
            (new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) /
            1000,
        )
        .filter((s) => Number.isFinite(s) && s >= 0);
      const practice = attempts.filter((a) => !a.isPretest && a.pL !== null);

      students.push({
        userId,
        name: names.get(userId) ?? `#${userId}`,
        isCorrect: first.isCorrect,
        attempts: attempts.length,
        firstAnswer: first.chosenAnswer,
        timeSpentSec: durations.length
          ? round1(durations.reduce((s, v) => s + v, 0) / durations.length)
          : null,
        // progress (what students see), never raw P(L) — docs/adr/0001
        latestProgress: practice.length
          ? MasteryState.progressOf(practice[practice.length - 1].pL as number)
          : null,
        lastAnsweredAt: last.endTime,
      });

      const key = first.chosenAnswer ?? '';
      firstAnswerCount.set(key, (firstAnswerCount.get(key) ?? 0) + 1);
    }

    // wrong first, then slowest — what a teacher usually wants to look at first
    students.sort((a, b) => {
      if (a.isCorrect !== b.isCorrect) return a.isCorrect ? 1 : -1;
      return (b.timeSpentSec ?? 0) - (a.timeSpentSec ?? 0);
    });

    let choices: ExerciseStatChoiceDto[];
    if (exercise.type === 'CHOICE') {
      choices = (exercise.exerciseChoices ?? []).map((c) => ({
        choiceId: c.id,
        text: c.script ?? '',
        isCorrect: c.isAnswer,
        pickedCount: firstAnswerCount.get(c.script ?? '') ?? 0,
      }));
    } else {
      // fill-in-the-blank: the distinct typed answers, most common first (top 10)
      const expected = exercise.fillInBlank ?? '';
      const caseSensitive = exercise.isCasesensitive === 'YES';
      choices = Array.from(firstAnswerCount.entries())
        .map(([text, pickedCount]) => ({
          choiceId: null,
          text,
          isCorrect: caseSensitive
            ? text === expected
            : text.toLowerCase() === expected.toLowerCase(),
          pickedCount,
        }))
        .sort((a, b) => b.pickedCount - a.pickedCount)
        .slice(0, 10);
    }

    return {
      ...summary,
      fullDescription: exercise.description ?? '',
      code: exercise.code ?? null,
      language: exercise.language ?? null,
      attemptsAll: rows.length,
      choices,
      students,
    };
  }
}
