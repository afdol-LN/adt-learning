export class CreateFacultyDto {
  faculty: string;
  campusId: number;
}

export class UpdateFacultyDto {
  faculty?: string;
  campusId?: number;
}
