import { RestAPIResponse } from '../RestAPI.dto';
export class CreateFacultyDto {
  faculty: string;
  campusId: number;
}

export class UpdateFacultyDto {
  faculty?: string;
  campusId?: number;
}

interface facultyInfo {
  facultyId: number;
  facultyName: string;
  campusid: number;
}

export type facultyInfoResponse = RestAPIResponse<facultyInfo[]>;
