import { RestAPIResponse } from './RestAPI.dto';

export class BranchDashboardDto {
  skillsUnlockedCount: number;
  sessionsCount: number;
  dayStreak: number;
  /** Goal progress — the same numbers the goal node shows (docs/adr/0005) */
  goalProgressPercent: number;
  goalMasteredCount: number;
  goalRequiredCount: number;
  goalComplete: boolean;
}

export type responseBranchDashboard = RestAPIResponse<BranchDashboardDto>;
