import { Body, Controller, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { sessionService } from 'src/service/session.service';
import {
  StartSessionDto,
  StartSessionResponseDto,
  SubmitAnswerDto,
  SubmitAnswerResponseDto,
} from 'src/dto/exerciseAndSession/session.dto';

@ApiTags('Session')
@Controller('/session')
export class sessionController {
  constructor(private readonly sessionService: sessionService) {}

  // ตอบทันที ไม่รอ engine ตื่น — frontend ยิงตอนเปิดหน้า Home
  @Post('/warmup')
  warmUp(): { ok: true } {
    this.sessionService.warmUpEngine();
    return { ok: true };
  }

  @Post('/start')
  async startSession(
    @Req() req: AuthenRequestDto,
    @Body() dto: StartSessionDto,
  ): Promise<StartSessionResponseDto> {
    return await this.sessionService.startSession(req.user!.userId, dto);
  }

  @Post(':sessionId/answer')
  async submitAnswer(
    @Req() req: AuthenRequestDto,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    return await this.sessionService.submitAnswer(
      req.user!.userId,
      sessionId,
      dto,
    );
  }
}
