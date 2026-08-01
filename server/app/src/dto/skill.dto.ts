import { Status } from 'src/enums/status.enum';

export class CreateSkillDto {
  skillCode!: string;
  skillsName!: string;
  tier?: string;
  status?: Status;
}

export class UpdateSkillDto {
  skillsName?: string;
  tier?: string;
  status?: Status;
}

export class SkillPrerequisiteItemDto {
  prerequisiteSkillId!: number;
  prerequisiteLevel?: number;
}

export class CreateSkillWithPrerequisiteDto extends CreateSkillDto {
  prerequisites!: SkillPrerequisiteItemDto[];
}

export class UpdateSkillWithPrerequisiteDto extends UpdateSkillDto {
  prerequisites?: SkillPrerequisiteItemDto[];
}
