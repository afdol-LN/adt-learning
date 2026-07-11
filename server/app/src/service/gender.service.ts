import { Injectable } from "@nestjs/common";
import { BaseService } from "./base.service";
import { Gender } from "src/entity/gender.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";


@Injectable()
export class genderService extends BaseService<Gender>{
    constructor(
        @InjectRepository(Gender)
        private readonly genderRopository: Repository<Gender>
    ){
        super(genderRopository);
    }
}