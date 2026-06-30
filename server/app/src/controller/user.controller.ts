import { BaseController } from "./base.controller";
import { Userprofile } from "src/entity/userprofile.entity";
import { userProfileService } from "src/service/user.service";
import { Controller } from "@nestjs/common";

@Controller('/userprofile')
export class userController extends BaseController<Userprofile>{
    constructor(
        private readonly userService: userProfileService,
    ) {
        super(userService);
    }
}