import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PretestBreakdownItemDto, responseGetBranch } from 'src/dto/branch.dto';
import { Branch } from 'src/entity/branch.entity';
import { History } from 'src/entity/history.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { MasteryState } from 'src/libs/bkt/masteryState';
import {
  PretestAnswerStat,
  PretestMasteryCalculator,
} from 'src/libs/bkt/pretestMastery';
import { SkillTier } from 'src/libs/bkt/tier';
import { In, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ForbiddenException } from '@nestjs/common';
@Injectable()
export class branchService extends BaseService<Branch> {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    @InjectRepository(GoalSkillRequire)
    private readonly goalSkillRequireRepository: Repository<GoalSkillRequire>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Userprofile)
    private readonly userprofileRepository: Repository<Userprofile>,
  ) {
    super(branchRepository);
  }

  /**
   * Onboarding: the student went back from the pretest intro and changed their
   * experience. Only the experience moves — the goal is fixed once the branch exists.
   * Ownership is part of the lookup, so another user's branch looks exactly like a
   * missing one (404) and its existence isn't leaked.
   */
  async updateExpForSelf(
    userId: number,
    branchId: number,
    expForGoal: number,
  ): Promise<{ id: number; expForGoal: number }> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, userId },
    });
    if (!branch) throw new NotFoundException('ไม่พบ branch นี้');

    // ValidationPipe ปิดอยู่ (main.ts) — ตรวจเองตามแบบ service อื่น
    if (!Number.isInteger(expForGoal) || expForGoal < 1 || expForGoal > 5) {
      throw new BadRequestException('expForGoal ต้องเป็นจำนวนเต็ม 1–5');
    }
    // ข้อสอบ pretest ถูกสุ่มตามระดับเดิม และผลถูก seed ลง conceptMapState แล้ว
    if (branch.isAlreadyPretest) {
      throw new BadRequestException(
        'ทำ pretest ของ branch นี้แล้ว เปลี่ยนระดับประสบการณ์ไม่ได้',
      );
    }

    branch.expForGoal = expForGoal;
    await this.branchRepository.save(branch);
    return { id: branch.id, expForGoal };
  }

  async findAllForUser(userId: number): Promise<responseGetBranch> {
    try {
      const branches = await this.branchRepository.find({
        where: { userId },
        relations: {
          goal: {
            goalSkillRequire: true,
          },
        },
      });

      const response: responseGetBranch = {
        isError: false,
        data: branches.map((b) => ({
          id: b.id,
          userId: b.userId,
          goalId: b.goalId,
          expForGoal: b.expForGoal,
          isAlreadyPretest: b.isAlreadyPretest,
          goalCompletedAt: b.goalCompletedAt,
          goal: {
            id: b.goal.id,
            goal: b.goal.goal,
            goalDescription: b.goal.goalDescription,
            status: b.goal.status,
            goalSkillRequire: b.goal.goalSkillRequire.map((req) => ({
              goalId: req.goalId,
              skillId: req.skillId,
              levelRequire: req.levelRequire,
            })),
          },
        })),
        errorMassege: null,
      };

      return response;
    } catch (error) {
      return {
        isError: true,
        data: null,
        errorMassege:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * ที่มาของคะแนนเริ่มต้นแต่ละ skill หลังทำ pretest — คำนวณย้อนจากข้อมูลตั้งต้นทุกครั้ง
   * (ข้อ pretest ใน history, expForGoal, tier, โปรไฟล์) ด้วยสูตรเดียวกับตอน seed
   * (`PretestMasteryCalculator.breakdown`) จึงไม่ต้องเก็บอะไรเพิ่ม
   * ข้อจำกัด: ใช้โปรไฟล์ปัจจุบัน ถ้าแก้ชั้นปี/สาขาหลังทำ pretest ตัวเลขจะต่างจากตอน seed
   */
  async getPretestBreakdown(
    branchId: number,
    userId: number,
  ): Promise<PretestBreakdownItemDto[]> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException('ไม่พบ branch นี้');
    if (branch.userId !== userId) {
      throw new ForbiddenException('Branch does not belong to the user');
    }
    if (!branch.isAlreadyPretest) return [];

    const [pretestHistory, goalSkillRequires, userprofile] = await Promise.all([
      this.historyRepository.find({
        where: { branchId, isPretest: true },
        relations: { sessionAndExercise: { exercise: true } },
      }),
      this.goalSkillRequireRepository.find({
        where: { goalId: branch.goalId },
      }),
      this.userprofileRepository.findOne({
        where: { id: userId },
        relations: { major: true },
      }),
    ]);

    const goalSkills = goalSkillRequires.length
      ? await this.skillRepository.find({
          where: { skillId: In(goalSkillRequires.map((r) => r.skillId)) },
        })
      : [];

    // รวมสถิติรายข้อต่อ skill แบบเดียวกับ exerciseService.submitPretest
    const statsBySkill = new Map<number, PretestAnswerStat[]>();
    for (const h of pretestHistory) {
      const exercise = h.sessionAndExercise?.exercise;
      if (!exercise) continue;
      const stats = statsBySkill.get(exercise.skillId) ?? [];
      stats.push({
        isCorrect: h.isCorrect,
        actualTimeSeconds:
          (new Date(h.endTime).getTime() - new Date(h.startTime).getTime()) /
          1000,
        expectTime: exercise.expectTime ?? null,
      });
      statsBySkill.set(exercise.skillId, stats);
    }

    const profile = {
      isAboutCs: userprofile?.major?.isAboutCs ?? false,
      year: userprofile?.year ?? null,
    };

    return goalSkills.map((skill) => {
      const stats = statsBySkill.get(skill.skillId) ?? [];
      const parts = PretestMasteryCalculator.breakdown(
        branch.expForGoal,
        SkillTier.tierNum(skill.tier),
        stats,
        profile,
      );
      const totalPercent = MasteryState.progressOf(parts.total);
      const basePercent = MasteryState.progressOf(parts.base);
      const pretestPercent = MasteryState.progressOf(parts.pretest);
      const profilePercent = MasteryState.progressOf(parts.profile);
      // ชนเพดานเมื่อผลรวมดิบเกิน total — ส่วนเกินคือแถว "จำกัดสูงสุด"
      // ไม่ชนเพดานก็อาจต่างจาก total 0.01–0.02 เพราะแต่ละส่วนตัดทศนิยมลงแยกกัน (ADR 0004)
      const capped = parts.base + parts.pretest + parts.profile > parts.total;
      const capPercent = capped
        ? Math.round(
            (basePercent + pretestPercent + profilePercent - totalPercent) * 100,
          ) / 100
        : 0;

      return {
        skillId: skill.skillId,
        skillsName: skill.skillsName,
        totalPercent,
        basePercent,
        pretestPercent,
        profilePercent,
        capPercent,
        correct: stats.filter((s) => s.isCorrect).length,
        answered: stats.length,
      };
    });
  }
}
