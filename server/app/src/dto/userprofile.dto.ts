import { UserRole } from 'src/enums/user-role.enum';

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
  status?: number;
  behaviorScore?: number;
  conceptMapState?: any;
  strengthWeaknessMatrix?: any;
  // role?: UserRole;
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
  status?: number;
  behaviorScore?: number;
  conceptMapState?: any;
  strengthWeaknessMatrix?: any;
  // role?: UserRole;
}

export class userAccessRequestDto {
  authenToken: string;
  authenSignature: string;
}
