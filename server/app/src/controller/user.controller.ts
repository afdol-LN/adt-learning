import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { BaseController } from "./base.controller";
import { Userprofile } from "src/entity/userprofile.entity";
import { userProfileService } from "src/service/user.service";
import { responseUser } from "src/type/user.interface";

@Controller('/userprofile')
export class userController extends BaseController<Userprofile> {
    constructor(
        private readonly userService: userProfileService,
    ) {
        super(userService);
    }

    @Get('campus/:campusId')
    async findUserWithcampus(
        @Param('campusId', ParseIntPipe) campusId: number,
    ): Promise<responseUser[]> {
        return await this.userService.findUserWithcampus(campusId);
    }
}
