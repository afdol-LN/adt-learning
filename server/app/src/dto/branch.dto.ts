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

// Onboarding "back to experience" — the only field a student may change on their
// own branch. Validated in branchService.updateExpForSelf (ValidationPipe is off).
export class UpdateBranchExpForSelfDto {
  @IsInt()
  expForGoal!: number;
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

  /** ADR 0005: sticky — once set, this branch's goal stays complete. */
  goalCompletedAt!: Date | null;

  goal!: GoalInfoWithPrerequisite;
}

export type responseGetBranch = RestAPIResponse<BranchInfo[]>;

/**
 * ที่มาของคะแนนเริ่มต้นจาก pretest ของหนึ่ง skill — ทุกค่าเป็นหน่วย Progress (%)
 * ไม่ใช่ P(L) ดิบ (ADR 0001) และตัดทศนิยมลง 2 ตำแหน่ง (ADR 0004)
 */
export interface PretestBreakdownItemDto {
  skillId: number;
  skillsName: string;
  /** คะแนนเริ่มต้นรวม = Progress ของ pL0 */
  totalPercent: number;
  /** ประสบการณ์ที่กรอก (expForGoal) เทียบกับ tier ของ skill */
  basePercent: number;
  /** ความถูกต้องและความเร็วในข้อ pretest ของ skill นี้ */
  pretestPercent: number;
  /** สาขาเกี่ยวกับคอมพิวเตอร์ / ชั้นปี 2 ขึ้นไป */
  profilePercent: number;
  /** ส่วนที่ถูกตัดเพราะชนเพดาน pL0 (0 ถ้าไม่ชน) */
  capPercent: number;
  correct: number;
  answered: number;
}
