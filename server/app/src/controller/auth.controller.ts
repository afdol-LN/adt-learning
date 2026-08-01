import { Controller, Post } from '@nestjs/common';
import { BaseController } from './base.controller';
import { Userprofile } from 'src/entity/userprofile.entity';
import { authService } from 'src/service/auth.service';
import { Body } from '@nestjs/common';
import { userAccessRequestDto } from 'src/dto/userprofile.dto';
import { Logger } from '@nestjs/common';
@Controller('/authen')
export class authController extends BaseController<Userprofile> {
  private readonly logger = new Logger(authController.name);
  constructor(private readonly auth: authService) {
    super(auth);
  }

  @Post('/authen_request')
  async authenRequest(@Body('authenRequest') authenRequest: string) {
    console.log('authenRequest : ', authenRequest);
    const result = await this.auth.authenRequest(authenRequest);
    this.logger.log('authen_request result : ', result);
    return result;
  }

  @Post('/access_request')
  async accessRequest(@Body() accessRequest: userAccessRequestDto) {
    const result = await this.auth.accessRequest(
      accessRequest.authenToken,
      accessRequest.authenSignature,
    );
    this.logger.log('access_request result : ', result);
    return result;
  }
}
