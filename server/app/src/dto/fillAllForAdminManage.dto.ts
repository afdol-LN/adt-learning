import { restfulResponse } from './restfulResponse';

export class UserAdminItemDto {
  id: number;
  fullName: string;
  status: string;
  campusName: string;
  facultyName: string;
  majorName: string;
  goals: string;
  sessionCount: number;
  dayStreak: number;
  correctPercent: number;
}

export class fillAllForAdminManageResponseDto implements restfulResponse<
  UserAdminItemDto[] | null
> {
  isError: boolean;
  data: UserAdminItemDto[] | null;
  errorMessage: string;
}
