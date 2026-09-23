import { ReadinessResult, SkillReadiness } from 'src/libs/goal/goalReadiness';

export class WorkspaceGoalDto {
  id!: number;
  goal!: string;
  goalDescription!: string | null;
  status!: string;
}

export class WorkspaceSkillDto {
  skillId!: number;
  skillCode!: string;
  skillsName!: string;
  tier!: string | null;
  status!: string;
  required!: boolean;
  levelRequire!: number | null;
  prerequisiteSkillIds!: number[];
  goalCount!: number;
  activeExerciseCount!: number;
  activeExerciseLevels!: number[];
  pendingDraftCount!: number;
  readiness!: SkillReadiness;
}

export class GoalWorkspaceDto {
  goal!: WorkspaceGoalDto;
  branchCount!: number;
  minExercisesPerSkill!: number;
  skills!: WorkspaceSkillDto[];
  readiness!: ReadinessResult;
}

export class PublishGoalResultDto {
  activatedGoal!: boolean;
  activatedSkillIds!: number[];
}