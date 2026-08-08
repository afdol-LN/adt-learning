import { RestAPIResponse } from '../RestAPI.dto';

export class CreateMajorDto {
  major: string;
  facultyId: number;
}

export class UpdateMajorDto {
  major?: string;
  facultyId?: number;
}

export interface majorInfo {
  majorId: number;
  majorName: string;
  facultyId: number;
}

export type majorInfoResponse = RestAPIResponse<majorInfo[]>;
