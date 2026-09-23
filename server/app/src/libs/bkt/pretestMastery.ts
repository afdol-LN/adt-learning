import { SkillTier } from './tier';

export interface PretestAnswerStat {
  isCorrect: boolean;
  actualTimeSeconds: number;
  expectTime: number | null;
}

export interface ProfileFactors {
  isAboutCs: boolean;
  year: number | null;
}

const P_BASE_CAP = 0.75;
const P_BASE_FLOOR = 0.1;
const PL0_CAP = 0.85;

export class PretestMasteryCalculator {
  static computePBase(expForGoal: number | null, tierNum: number): number {
    const exp =
      expForGoal === null || expForGoal === undefined ? 3 : expForGoal;
    const clampedExp = Math.min(5, Math.max(1, exp));
    const gap = clampedExp - tierNum;
    if (gap <= -2) return P_BASE_FLOOR;
    if (gap === -1) return 0.15;
    if (gap === 0) return 0.25;
    if (gap === 1) return 0.4;
    if (gap === 2) return 0.55;
    if (gap === 3) return 0.65;
    return P_BASE_CAP; // gap >= 4
  }

  static computeAccuracy(stats: PretestAnswerStat[]): number {
    if (stats.length === 0) return 0;
    const correct = stats.filter((s) => s.isCorrect).length;
    return correct / stats.length;
  }

  private static computeSpeedFactor(stat: PretestAnswerStat): number {
    if (!stat.expectTime) return 0;
    const raw = (stat.expectTime - stat.actualTimeSeconds) / stat.expectTime;
    return Math.max(0, Math.min(1, raw));
  }

  static computeAverageSpeedFactor(stats: PretestAnswerStat[]): number {
    if (stats.length === 0) return 0;
    const total = stats.reduce((sum, s) => sum + this.computeSpeedFactor(s), 0);
    return total / stats.length;
  }

  static computeDeltaPretest(stats: PretestAnswerStat[]): number {
    return (
      this.computeAccuracy(stats) * 0.1 +
      this.computeAverageSpeedFactor(stats) * 0.05
    );
  }

  static computeDeltaProfile(profile: ProfileFactors): number {
    return (
      (profile.isAboutCs ? 0.05 : 0) +
      (profile.year !== null && profile.year >= 2 ? 0.04 : 0)
    );
  }

  static breakdown(
    expForGoal: number | null,
    tierNum: number,
    stats: PretestAnswerStat[],
    profile: ProfileFactors,
  ) {
    const base = this.computePBase(expForGoal, tierNum);
    const pretest = this.computeDeltaPretest(stats);
    const profileDelta = this.computeDeltaProfile(profile);
    const total = Math.min(PL0_CAP, base + pretest + profileDelta);
    return { base, pretest, profile: profileDelta, total };
  }

  static computePL0(
    expForGoal: number | null,
    tierNum: number,
    stats: PretestAnswerStat[],
    profile: ProfileFactors,
  ): number {
    // สูตรมีที่เดียวคือ breakdown() — หน้าอธิบายคะแนนเริ่มต้นใช้ตัวเดียวกัน ตัวเลขจึงตรงกันเสมอ
    return this.breakdown(expForGoal, tierNum, stats, profile).total;
  }
}

export { SkillTier };
