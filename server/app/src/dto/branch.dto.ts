export class CreateBranchDto {
  userId: number;
  goalId: number;
  expForGoal?: number;
}

export class UpdateBranchDto {
  userId?: number;
  goalId?: number;
  expForGoal?: number;
}
