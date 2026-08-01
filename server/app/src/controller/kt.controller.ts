import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { ktService } from '../service/kt.service';
import {
  SkillRegisterDto,
  ItemRegisterDto,
  AttemptRequestDto,
} from '../dto/kt/kt.dto';

@Controller('/kt')
export class ktController {
  private readonly logger = new Logger(ktController.name);

  constructor(private readonly ktService: ktService) {}

  @Post('/skill')
  async createSkill(@Body() dto: SkillRegisterDto) {
    this.logger.log(`Registering skill: ${dto.skillId}`);
    return await this.ktService.registerSkill(dto);
  }

  @Post('/item')
  async createItem(@Body() dto: ItemRegisterDto) {
    this.logger.log(
      `Registering item: ${dto.itemId} for skill: ${dto.skillId}`,
    );
    return await this.ktService.registerItem(dto);
  }

  @Post('/attempt')
  async submitAttempt(@Body() dto: AttemptRequestDto) {
    this.logger.log(
      `Processing attempt for student: ${dto.studentId}, item: ${dto.itemId}, correct: ${dto.correct}`,
    );
    return await this.ktService.submitAttempt(dto);
  }

  @Get('/mastery/:studentId/:skillId')
  async getMastery(
    @Param('studentId') studentId: string,
    @Param('skillId') skillId: string,
  ) {
    return await this.ktService.getMastery(studentId, skillId);
  }
}
