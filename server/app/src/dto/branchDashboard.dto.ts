import { RestAPIResponse } from './RestAPI.dto';

export class BranchDashboardDto {
  skillsUnlockedCount: number;
  sessionsCount: number;
  dayStreak: number;
  goalProgressPercent: number;
}

export type responseBranchDashboard = RestAPIResponse<BranchDashboardDto>;
