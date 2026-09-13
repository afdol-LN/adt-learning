import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { ktService } from '../service/kt.service';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';

@Controller('/kt')
export class ktController {
  private readonly logger = new Logger(ktController.name);

  constructor(private readonly ktService: ktService) {}

  @Post('/calibrate')
  @UseGuards(AdminMiddleware)
  async calibrate() {
    this.logger.log('Triggering BKT calibration');
    return await this.ktService.triggerCalibration();
  }
}
