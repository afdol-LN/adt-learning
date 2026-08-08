import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BktCornService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('BKT_ENGINE_URL') ||
      'http://localhost:8000';
  }
  //ทุก ๆ สัปดาห์
  @Cron(CronExpression.EVERY_WEEK)
  async handleBktcalibration() {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/calibrate`),
      );
      console.log('Successfully triggered BKT calibration.');
    } catch (error) {
      console.error('Failed to trigger BKT calibration', error.message);
    }
  }
}
