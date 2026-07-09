import { Controller, Logger } from "@nestjs/common";
import { exerciseService } from "src/service/exercise.service";
import { BaseController } from "./base.controller";
import { Exercise } from "src/entity/exerciseAndSession/exercise.entity";
import { Post } from "@nestjs/common";
import { Body } from "@nestjs/common";
import type { PretestBody } from "src/model/exercise.model";


@Controller('/exercise')
export class exerciseController  extends BaseController<Exercise> {
    constructor(private readonly exerciseService: exerciseService) {
        super(exerciseService);
    }

    @Post('/pretest')
    getPretestWithBody( @Body() pretestBody: PretestBody ){
        
        userId : pretestBody.userId;
        goalId : pretestBody.goalId;
        level : pretestBody.level;
        Logger.log(pretestBody)
        var response;
        try{
            response = await exerciseService.findPretest();
        }
    }


}