import { SkillGraph } from '../bkt/skillGraph';

/** ข้อที่นับได้ต่อ skill ขั้นต่ำ ก่อนที่ goal จะเปิดใช้งานได้ — นิยามที่เดียว import ไปใช้ทุกที่ */
export const MIN_EXERCISES_PER_SKILL = 5;

/** exercise.skillLevel ใช้จริงแค่ 1-5 (SLIP_BY_LEVEL) ส่วน Bloom มีถึง 6 */
export const MAX_SKILL_LEVEL = 5;

export type SkillReadiness = 'empty' | 'partial' | 'ready';

export type ReadinessRule =
  | 'HAS_REQUIRED_SKILL'
  | 'MIN_EXERCISES'
  | 'LEVEL_COVERAGE'
  | 'NO_PREREQ_CYCLE';

export interface ReadinessCheck {
  rule: ReadinessRule;
  skillIds: number[];
  passed: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
}

export interface ReadinessSkillInput {
  skillId: number;
  // อยู่ใน skill require ของ goal นี้หรือไม่
  required: boolean;
  levelRequire: number | null;
  prerequisiteSkillIds: number[];
  activeExerciseCount: number;
  activeExerciseLevels: number[];
}

export function skillReadinessOf(activeExerciseCount: number): SkillReadiness {
  if (activeExerciseCount <= 0) return 'empty';
  if (activeExerciseCount < MIN_EXERCISES_PER_SKILL) return 'partial';
  return 'ready';
}

const failing = (rule: ReadinessRule, skillIds: number[]): ReadinessCheck => ({
  rule,
  skillIds,
  passed: skillIds.length === 0,
});

export function evaluateReadiness(
  skills: ReadinessSkillInput[],
): ReadinessResult {
  const hasRequired = skills.some((s) => s.required);

  // เช็คทุก skill ใน closure ไม่ใช่แค่ required — prerequisite ที่ไม่มีข้อ
  // ทำให้ skill ถัดไปล็อกถาวร เพราะการปลดล็อกต้อง Progress 100%
  const notEnoughExercises = skills
    .filter((s) => s.activeExerciseCount < MIN_EXERCISES_PER_SKILL)
    .map((s) => s.skillId);

  const levelGap = skills
    .filter((s) => s.required && s.levelRequire != null)
    .filter((s) => {
      const target = Math.min(s.levelRequire!, MAX_SKILL_LEVEL);
      return !s.activeExerciseLevels.some((level) => level >= target);
    })
    .map((s) => s.skillId);

  // ใช้ตัวตรวจวงวนเดียวกับตอนเขียน prerequisite (อย่ามี 2 แบบ)
  const graph = skills.map((s) => ({
    skillId: s.skillId,
    skillPrequisite: s.prerequisiteSkillIds.map((prerequisiteSkillId) => ({
      prerequisiteSkillId,
    })),
  }));
  const onCycle = skills
    .filter((s) =>
      SkillGraph.wouldCreateCycle(graph, s.skillId, s.prerequisiteSkillIds),
    )
    .map((s) => s.skillId);

  // ร่างจาก AI ที่ยังไม่ตรวจค้างไว้ได้ ไม่ขวางการเปิดใช้งาน —
  // ร่างไม่นับเป็นข้อใน MIN_EXERCISES / LEVEL_COVERAGE อยู่แล้ว (นับเฉพาะ exercise ที่ active)
  const checks: ReadinessCheck[] = [
    { rule: 'HAS_REQUIRED_SKILL', skillIds: [], passed: hasRequired },
    failing('MIN_EXERCISES', notEnoughExercises),
    failing('LEVEL_COVERAGE', levelGap),
    failing('NO_PREREQ_CYCLE', onCycle),
  ];

  return { ready: checks.every((c) => c.passed), checks };
}
