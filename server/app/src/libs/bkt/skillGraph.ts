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

  static wouldCreateCycle<T extends SkillWithPrerequisites>(
    allSkills: T[],
    skillId: number,
    prerequisiteIds: number[],
  ): boolean {

    const prereqsOf = new Map<number, number[]>(
      allSkills.map((s)=> [
        s.skillId,
        (s.skillPrequisite || []).map((p)=> p.prerequisiteSkillId),
      ]),
    )

    prereqsOf.set(skillId, [...prerequisiteIds])

    const visited = new Set<number>();
    const stack = [...prerequisiteIds]

    while(stack.length > 0){
      const current = stack.pop()!;
      if(current === skillId) return true;
      if(visited.has(current)) continue;
      visited.add(current);
      for(const p of prereqsOf.get(current) ?? []){
        stack.push(p);
      } 
    }

    return false;
  }
}
