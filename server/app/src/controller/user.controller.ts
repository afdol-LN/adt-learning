import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  CreateUserprofileDto,
  UpdateUserprofileDto,
} from 'src/dto/userprofile.dto';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { Userprofile } from 'src/entity/userprofile.entity';
import { authService } from 'src/service/auth.service';
import { userProfileService } from 'src/service/user.service';
import { responseUser } from 'src/type/user.interface';
import { BaseController } from './base.controller';
import { Hash } from 'src/libs/hash';
import { UseGuards } from '@nestjs/common';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import { ApiTags } from '@nestjs/swagger';
import { activityService } from 'src/service/activity.service';
import type { ActivityQuery } from 'src/service/activity.service';

@ApiTags('User Profile')
@Controller('/userprofile')
export class userController extends BaseController<Userprofile> {
  constructor(
    private readonly userService: userProfileService,
    private readonly auth: authService,
    private readonly hash: Hash,
    private readonly activity: activityService,
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

  @Patch('/me')
  async updateMe(
    @Req() req: AuthenRequestDto,
    @Body() data: UpdateUserprofileDto,
  ) {
    return await this.userService.update(req.user!.userId, data);
  }

  @UseGuards(AdminMiddleware)
  @Get('/admin/user_list')
  async userList() {
    return await this.userService.fillAllForAdminManage();
  }

  @UseGuards(AdminMiddleware)
  @Put('/admin/update_status/:id')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return await this.userService.updateUserStatus(id, status);
  }

  // timeline for the admin History tab: ?types=all|goal|skill|exercise|login&userId=&page=&pageSize=
  @UseGuards(AdminMiddleware)
  @Get('/admin/activity')
  async activityTimeline(@Query() query: ActivityQuery) {
    try {
      const data = await this.activity.getActivity(query);
      return { isError: false, data, errorMessage: '' };
    } catch (error: any) {
      return { isError: true, data: null, errorMessage: error.message };
    }
  }

  @UseGuards(AdminMiddleware)
  @Get('/admin/roles')
  async getRoles() {
    return await this.userService.getRoles();
  }

  @UseGuards(AdminMiddleware)
  @Post('/admin/create_user')
  async createAdminUser(@Body() userprofile: CreateUserprofileDto) {
    return await this.userService.createAdminUser(userprofile);
  }

  @UseGuards(AdminMiddleware)
  @Put('/admin/update_user/:id')
  async updateAdminUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() userprofile: UpdateUserprofileDto,
  ) {
    return await this.userService.updateAdminUser(id, userprofile);
  }

  @Put('/update_tour/:id')
  async updateUserTour(
    @Param('id', ParseIntPipe) id:number,
  ){
    return await this.userService.userTourState(id);
  }
}
