export class CreateSkillDto {
  skillId: number;
  skillsName: string;
  tier?: string;
  status?: number;
}

export class UpdateSkillDto {
  skillsName?: string;
  tier?: string;
  status?: number;
}
