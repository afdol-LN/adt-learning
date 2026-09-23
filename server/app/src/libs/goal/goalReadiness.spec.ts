import {
  MIN_EXERCISES_PER_SKILL,
  ReadinessRule,
  ReadinessSkillInput,
  evaluateReadiness,
  skillReadinessOf,
} from './goalReadiness';

const skill = (over: Partial<ReadinessSkillInput> = {}): ReadinessSkillInput => ({
  skillId: 1,
  required: true,
  levelRequire: null,
  prerequisiteSkillIds: [],
  activeExerciseCount: MIN_EXERCISES_PER_SKILL,
  activeExerciseLevels: [1, 2, 3],
  ...over,
});

const check = (skills: ReadinessSkillInput[], rule: ReadinessRule) =>
  evaluateReadiness(skills).checks.find((c) => c.rule === rule)!;

describe('skillReadinessOf', () => {
  it('is empty at zero, partial below the minimum, ready at or above it', () => {
    expect(skillReadinessOf(0)).toBe('empty');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL - 1)).toBe('partial');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL)).toBe('ready');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL + 10)).toBe('ready');
  });
});

describe('evaluateReadiness', () => {
  it('passes every rule for a healthy one-skill goal', () => {
    const result = evaluateReadiness([skill({ levelRequire: 3 })]);
    expect(result.ready).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails HAS_REQUIRED_SKILL when nothing is required', () => {
    expect(check([], 'HAS_REQUIRED_SKILL').passed).toBe(false);
    expect(check([skill({ required: false })], 'HAS_REQUIRED_SKILL').passed).toBe(false);
  });

  it('fails MIN_EXERCISES for a pulled-in prerequisite with no exercises', () => {
    // skill 2 is required and complete; skill 1 is only a prerequisite and empty.
    // Students would hit a permanent lock: unlocking 2 needs Progress 100% on 1.
    const failing = check(
      [
        skill({ skillId: 1, required: false, activeExerciseCount: 0, activeExerciseLevels: [] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'MIN_EXERCISES',
    );
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('counts only active exercises, which the caller has already filtered', () => {
    const failing = check([skill({ activeExerciseCount: MIN_EXERCISES_PER_SKILL - 1 })], 'MIN_EXERCISES');
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('passes LEVEL_COVERAGE when a level at or above levelRequire exists', () => {
    expect(check([skill({ levelRequire: 3, activeExerciseLevels: [1, 3] })], 'LEVEL_COVERAGE').passed).toBe(true);
    expect(check([skill({ levelRequire: 3, activeExerciseLevels: [1, 4] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('fails LEVEL_COVERAGE when every exercise sits below levelRequire', () => {
    const failing = check([skill({ levelRequire: 4, activeExerciseLevels: [1, 2, 3] })], 'LEVEL_COVERAGE');
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('treats Bloom level 6 as satisfied by a skillLevel 5 exercise', () => {
    // levelRequire is Bloom 1-6; exercise.skillLevel only goes to 5.
    expect(check([skill({ levelRequire: 6, activeExerciseLevels: [5] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('does not check level coverage when levelRequire is null', () => {
    expect(check([skill({ levelRequire: null, activeExerciseLevels: [1] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('does not check level coverage for a pulled-in skill', () => {
    const result = check(
      [
        skill({ skillId: 1, required: false, levelRequire: 5, activeExerciseLevels: [1] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'LEVEL_COVERAGE',
    );
    expect(result.passed).toBe(true);
  });

  it('fails NO_PREREQ_CYCLE on legacy cyclic data and names both skills', () => {
    const failing = check(
      [
        skill({ skillId: 1, prerequisiteSkillIds: [2] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'NO_PREREQ_CYCLE',
    );
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1, 2]);
  });

  it('reports the rules in a stable order', () => {
    expect(evaluateReadiness([skill()]).checks.map((c) => c.rule)).toEqual([
      'HAS_REQUIRED_SKILL',
      'MIN_EXERCISES',
      'LEVEL_COVERAGE',
      'NO_PREREQ_CYCLE',
    ]);
  });
});
