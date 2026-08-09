import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { sessionService } from 'src/service/session.service';
import {
  StartSessionDto,
  StartSessionResponseDto,
} from 'src/dto/exerciseAndSession/session.dto';

@ApiTags('Session')
@Controller('/session')
export class sessionController {
  constructor(private readonly sessionService: sessionService) {}

  @Post('/start')
  async startSession(
    @Req() req: AuthenRequestDto,
    @Body() dto: StartSessionDto,
  ): Promise<StartSessionResponseDto> {
    return await this.sessionService.startSession(req.user!.userId, dto);
  }
}
