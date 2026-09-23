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

// docs/adr/0006: expForGoal is self-reported, so it only nudges the start (≤ 0.35); the parts
// add up to 0.55 at most, which a correct answer or two still has to lift to 0.95.
const P_BASE_CAP = 0.35;
const P_BASE_FLOOR = 0.1;
// safety net only — base + pretest + profile can't reach it with the values below
const PL0_CAP = 0.6;

export class PretestMasteryCalculator {
  static computePBase(expForGoal: number | null, tierNum: number): number {
    const exp =
      expForGoal === null || expForGoal === undefined ? 3 : expForGoal;
    const clampedExp = Math.min(5, Math.max(1, exp));
    const gap = clampedExp - tierNum;
    if (gap <= -2) return P_BASE_FLOOR;
    if (gap === -1) return 0.12;
    if (gap === 0) return 0.15;
    if (gap === 1) return 0.2;
    if (gap === 2) return 0.25;
    if (gap === 3) return 0.3;
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
      (profile.isAboutCs ? 0.03 : 0) +
      (profile.year !== null && profile.year >= 2 ? 0.02 : 0)
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
