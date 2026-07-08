import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/service/base.service";
import { Campus } from "src/entity/university/campus.entity";
import { Repository } from "typeorm";

@Injectable()
export class campusService extends BaseService<Campus>{
    constructor(
        @InjectRepository(Campus)
        private readonly campusRepository: Repository<Campus>,
    ) {
        super(campusRepository);
    }    
}