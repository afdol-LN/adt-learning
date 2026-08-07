import { IsInt } from 'class-validator';
import { Status } from 'src/enums/status.enum';
import { CreateGoalSkillRequireDto } from './goalSkillRequire.dto';
export class GoalInfoWithPrerequisite {
  id!: number;
  goal: string;
  goalDescription: string;
  status: string;
  goalSkillRequire: CreateGoalSkillRequireDto[];
}

export class CreateGoalDto {
  goal!: string;
  goalDescription?: string;
  status?: Status;
}

export class UpdateGoalDto {
  goal?: string;
  goalDescription?: string;
  status?: Status;
}

export class GoalSkillRequireItemDto {
  skillId!: number;
  levelRequire?: number;
}

export class CreateGoalWithSkillRequireDto extends CreateGoalDto {
  skillRequires!: GoalSkillRequireItemDto[];
}

export class UpdateGoalWithSkillRequireDto extends UpdateGoalDto {
  skillRequires?: GoalSkillRequireItemDto[];
}
