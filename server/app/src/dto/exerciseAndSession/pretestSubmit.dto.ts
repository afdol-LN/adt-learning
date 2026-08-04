import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PretestAnswerDto {
  @IsNumber()
  exerciseId: number;

  @IsBoolean()
  isCorrect: boolean;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  @IsOptional()
  chosenAnswer?: string;
}

export class PretestSubmitDto {
  @IsNumber()
  branchId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PretestAnswerDto)
  answers: PretestAnswerDto[];
}
