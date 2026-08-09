export interface SkillWithPrerequisites {
  skillId: number;
  skillPrequisite: { prerequisiteSkillId: number }[];
}

export class SkillGraph {
  static getRelevantSkillIds<T extends SkillWithPrerequisites>(
    allSkills: T[],
    goalSkillRequire: { skillId: number }[],
  ): Set<number> {
    const skillById = new Map(allSkills.map((s) => [s.skillId, s]));
    const relevant = new Set<number>();
    const stack = goalSkillRequire.map((r) => r.skillId);

    while (stack.length > 0) {
      const id = stack.pop()!;
      if (relevant.has(id)) continue;
      relevant.add(id);
      const prereqs = skillById.get(id)?.skillPrequisite || [];
      for (const p of prereqs) {
        if (!relevant.has(p.prerequisiteSkillId)) {
          stack.push(p.prerequisiteSkillId);
        }
      }
    }

    return relevant;
  }
}
