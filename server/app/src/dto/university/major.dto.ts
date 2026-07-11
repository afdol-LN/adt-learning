export class CreateMajorDto {
  major: string;
  facultyId: number;
}

export class UpdateMajorDto {
  major?: string;
  facultyId?: number;
}
