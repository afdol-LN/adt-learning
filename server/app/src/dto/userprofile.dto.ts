import { UserRole } from 'src/enums/user-role.enum';
import { Request } from 'express';
export class CreateUserprofileDto {
  // firstName: string;   // merge → fullName before save
  // lastName: string;    // merge → fullName before save
  fullName : string;
  genderId: number;
  birthDate: string;
  campusId?: number;
  facultyId?: number;
  majorId?: number;
  username: string;
  password: string;
  status?: string;
  behaviorScore?: number;
  conceptMapState?: any;
  strengthWeaknessMatrix?: any;
  role?: UserRole;
}

export class UpdateUserprofileDto {
  firstName?: string;
  lastName?: string;
  genderId?: number;
  birthDate?: string;
  campusId?: number;
  facultyId?: number;
  majorId?: number;
  username?: string;
  password?: string;
  status?: string;
  behaviorScore?: number;
  conceptMapState?: any;
  strengthWeaknessMatrix?: any;
  role?: UserRole;
}

export class userAccessRequestDto {
  authenToken: string;
  authenSignature: string;
}


export interface AuthenRequestDto extends Request{
  user?: {
    userId : number;
    fullName : string;
    userRole : string;
  }
}
  