import { UserRole } from 'src/enums/user-role.enum';
import { Status } from 'src/enums/status.enum';
import { Request } from 'express';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUserprofileDto {
  @IsString()
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsInt()
  genderId?: number;

  @IsString()
  birthDate!: string;

  @IsOptional()
  @IsInt()
  campusId?: number;

  @IsOptional()
  @IsInt()
  facultyId?: number;

  @IsOptional()
  @IsInt()
  majorId?: number;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsString()
  @MaxLength(20)
  username!: string;

  @IsString()
  @MaxLength(80)
  password!: string;

  @IsOptional()
  @IsEnum(Status)
  status?: string;

  @IsOptional()
  @IsNumber()
  behaviorScore?: number;

  @IsOptional()
  conceptMapState?: any;

  @IsOptional()
  strengthWeaknessMatrix?: any;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserprofileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsInt()
  genderId?: number;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsInt()
  campusId?: number;

  @IsOptional()
  @IsInt()
  facultyId?: number;

  @IsOptional()
  @IsInt()
  majorId?: number;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  password?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: string;

  @IsOptional()
  @IsNumber()
  behaviorScore?: number;

  @IsOptional()
  conceptMapState?: any;

  @IsOptional()
  strengthWeaknessMatrix?: any;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class userAccessRequestDto {
  @IsString()
  authenToken!: string;

  @IsString()
  authenSignature!: string;
}

export interface AuthenRequestDto extends Request {
  user?: {
    userId: number;
    fullName: string;
    userRole: string;
  };
}
