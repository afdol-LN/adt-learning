import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Major } from 'src/entity/university/major.entity';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { majorInfoResponse } from 'src/dto/university/major.dto';

@Injectable()
export class majorService extends BaseService<Major> {
  constructor(
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
  ) {
    super(majorRepository);
  }

  async getMajorByFaculty(facultyId: number): Promise<majorInfoResponse> {
    try {
      const result = await this.majorRepository.find({
        where: {
          facultyId: facultyId,
        },
      });

      if (!result || result.length === 0) {
        return {
          isError: true,
          data: null,
          errorMassege: 'not found major for this faculty',
        };
      } else {
        return {
          isError: false,
          data: result.map((item) => ({
            majorId: item.id,
            majorName: item.major,
            facultyId: item.facultyId,
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
