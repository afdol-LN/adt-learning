import { BaseService } from "./base.service";
import { Userprofile } from "src/entity/userprofile.entity";
import { Repository } from "typeorm";
import { responseUser } from "src/type/user.interface";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class userProfileService extends BaseService<Userprofile>{
    constructor(
        @InjectRepository(Userprofile)
        private readonly userProfileRepository: Repository<Userprofile>,
    ) {
        super(userProfileRepository);
    }

    async findUserWithcampus(campusId: number): Promise<responseUser[]> {
        const result = await this.userProfileRepository.find({
            where: { campusId },
            relations: {
                gender: true,
                campus: true,
                faculty: true,
                major: true,
            },
        });

        return result.map((userProfile) => ({
            id: userProfile.id,
            fullName : userProfile.fullName,
            gender: userProfile.gender.gender,
            birthDate: userProfile.birthDate,
            campus: userProfile.campus.campus,
            faculty: userProfile.faculty.faculty,
            major: userProfile.major.major,
        }));
    }
}
