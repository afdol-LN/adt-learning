import { BaseService } from "./base.service";
import { Userprofile } from "src/entity/userprofile.entity";
import { Repository } from "typeorm";

export class userProfileService extends BaseService<Userprofile>{
    constructor(
        private readonly userProfileRepository: Repository<Userprofile>,
    ) {
        super(userProfileRepository);
    }
}