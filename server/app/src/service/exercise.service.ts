import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/service/base.service";
import { Exercise } from "src/entity/exerciseAndSession/exercise.entity";
import { Repository } from "typeorm";


@Injectable()
export class exerciseService extends BaseService<Exercise> {
    constructor(
        @InjectRepository(Exercise)
        private readonly exerciseRepository: Repository<Exercise>,
    ) {
        super(exerciseRepository);
    }

    async findPretest(goalId: number){
        const result = await this.exerciseRepository.find({
            
        })
    }
}
