import { IsInt, IsOptional } from 'class-validator';
import { GoalInfoWithPrerequisite } from './goal.dto';
import { RestAPIResponse } from './RestAPI.dto';
export class CreateBranchDto {
  @IsInt()
  userId!: number;

  @IsInt()
  goalId!: number;

  @IsOptional()
  @IsInt()
  expForGoal?: number;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsInt()
  goalId?: number;

  @IsOptional()
  @IsInt()
  expForGoal?: number;
}

// Client-facing shape for the authenticated user creating their own branch —
// userId is deliberately excluded and resolved from the JWT instead, so a
// caller can't create a branch under someone else's account.
export class CreateBranchForSelfDto {
  @IsInt()
  goalId!: number;

  @IsOptional()
  @IsInt()
  expForGoal?: number;
}

export class BranchInfo {
  @IsInt()
  id!: number;

  @IsInt()
  userId!: number;

  @IsInt()
  goalId!: number;

  @IsInt()
  expForGoal!: number;

  isAlreadyPretest!: boolean;

  goal!: GoalInfoWithPrerequisite;
}

export type responseGetBranch = RestAPIResponse<BranchInfo[]>;
