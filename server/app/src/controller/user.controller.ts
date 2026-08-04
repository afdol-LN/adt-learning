import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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

@ApiTags('User Profile')
@Controller('/userprofile')
export class userController extends BaseController<Userprofile> {
  constructor(
    private readonly userService: userProfileService,
    private readonly auth: authService,
    private readonly hash: Hash,
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
}
