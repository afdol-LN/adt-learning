import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { ktService } from '../service/kt.service';
import {
  SkillRegisterDto,
  ItemRegisterDto,
  AttemptRequestDto,
} from '../dto/kt/kt.dto';

@Controller('/adaptive-engine')
export class ktController {
  private readonly logger = new Logger(ktController.name);

  constructor(private readonly ktService: ktService) {}
}