import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/service/base.service";
import { Exercise } from "src/entity/exerciseAndSession/exercise.entity";
import { Repository } from "typeorm";
import { ExerciseChoice } from "src/entity/exerciseAndSession/exerciseChoice.entity";
import { CreateExerciseChoiceDto } from "src/dto/exerciseAndSession/exerciseChoice.dto";
import { CreateExerciseDto } from "src/dto/exerciseAndSession/exercise.dto";
import { Logger } from "@nestjs/common";
@Injectable()
export class exerciseService extends BaseService<Exercise> {
    private readonly logger = new Logger(exerciseService.name);
    constructor(
        @InjectRepository(Exercise)
        private readonly exerciseRepository: Repository<Exercise>,
        @InjectRepository(ExerciseChoice)
        private readonly exerciseChoiceRepository: Repository<ExerciseChoice>,
    ) {
        super(exerciseRepository);
    }
    // async findPretest(){
    //     const result = await this.exerciseRepository.find({
            
    //     })
    
    // }

    async createExercise(exercise: CreateExerciseDto, exerciseChoices: CreateExerciseChoiceDto[]){
        const result = await this.exerciseRepository.save(exercise);
        this.logger.log("exercise result",result)
        exerciseChoices.forEach(exerciseChoice => {
            exerciseChoice.exerciseId = result.id;
        });
        const resultOfChoice = await this.exerciseChoiceRepository.save(exerciseChoices);
        this.logger.log("exercise choice result",resultOfChoice)
        const response = {
            exercise: result,
            exerciseChoices: resultOfChoice
        }
        return response;
    }
}
