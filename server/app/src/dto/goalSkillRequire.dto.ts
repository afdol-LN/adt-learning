export class CreateGoalSkillRequireDto {
  goalId: number;
  skillId: number;
  levelRequire?: number;
}

export class UpdateGoalSkillRequireDto {
  levelRequire?: number;
}
