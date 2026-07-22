import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Faculty } from 'src/entity/university/faculty.entity';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { facultyInfoResponse } from 'src/dto/university/faculty.dto';
@Injectable()
export class facultyService extends BaseService<Faculty> {
  constructor(
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
  ) {
    super(facultyRepository);
  }

  async getFacultyByCampus(id: number): Promise<facultyInfoResponse> {
    try {
      const result = await this.facultyRepository.find({
        where: {
          campusId: id,
        },
      });

      if (!result || result.length === 0) {
        return {
          isError: true,
          data: null,
          errorMassege: 'not found faculty for this campus',
        };
      } else {
        return {
          isError: false,
          data: result.map((item) => ({
            facultyId: item.id,
            facultyName: item.faculty,
            campusid: item.campusId,
          })),
          errorMassege: null,
        };
      }
    } catch (error) {
      return {
        isError: true,
        data: null,
        errorMassege: error instanceof Error ? error.message : 'Internal Server Error',
      };
    }
  }
}
