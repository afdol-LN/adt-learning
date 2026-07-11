export class CreateSkillPrerequisiteDto {
  skillId: number;
  prerequisiteSkillId: number;
  prerequisiteLevel?: number;
}

export class UpdateSkillPrerequisiteDto {
  prerequisiteLevel?: number;
}
