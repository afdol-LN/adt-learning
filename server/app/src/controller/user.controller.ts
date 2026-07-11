import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateUserprofileDto } from 'src/dto/userprofile.dto';
import { Userprofile } from 'src/entity/userprofile.entity';
import { authService } from 'src/service/auth.service';
import { userProfileService } from 'src/service/user.service';
import { responseUser } from 'src/type/user.interface';
import { BaseController } from './base.controller';

@Controller('/userprofile')
export class userController extends BaseController<Userprofile> {
  constructor(
    private readonly userService: userProfileService,
    private readonly auth: authService,
  ) {
    super(userService);
  }

  @Get('campus/:campusId')
  async findUserWithcampus(
    @Param('campusId', ParseIntPipe) campusId: number,
  ): Promise<responseUser[]> {
    return await this.userService.findUserWithcampus(campusId);
  }

  @Post('/register')
  async registerUser(@Body() userprofile: CreateUserprofileDto) {
    return await this.auth.register(userprofile);
  }

}
