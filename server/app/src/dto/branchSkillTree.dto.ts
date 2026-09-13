import { GoalNode } from 'src/libs/bkt/goalNode';

// GET /branch/:branchId/skills — one branch's skill tree: its skills, plus the goal node
// that ends it (docs/adr/0005). The goal node sits beside the skills, never inside the
// array, so nothing that walks the skills can mistake it for one.
export interface BranchSkillTreeDto {
  skills: any[];
  goal: GoalNode | null;
}
