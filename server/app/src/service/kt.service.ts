import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { restfulResponse } from '../dto/restfulResponse';
import { AttemptRequestDto, AttemptResponseDto } from '../dto/kt/kt.dto';

@Injectable()
export class ktService {
  private readonly logger = new Logger(ktService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      // this.configService.get<string>('BKT_ENGINE_URL') ||
      'http://localhost:8000';  
  }

  async submitAttempt(
    dto: AttemptRequestDto,
  ): Promise<restfulResponse<AttemptResponseDto | null>> {
    try {
      const payload = {
        p_l_current: dto.pLCurrent,
        p_t: dto.pT,
        p_g: dto.pG,
        p_s: dto.pS,
        isCorrect: dto.isCorrect,
        response_time: dto.responseTime,
        expect_time: dto.expectTime,
      };
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/attempt`, payload),
      );
      const data = response.data;
      return {
        isError: false,
        data: {
          pLPrior: data.p_l_prior,
          pLPosterior: data.p_l_posterior,
          pLNext: data.p_l_next,
          predictedCorrectProbNext: data.predicted_correct_prob_next,
          mastered: data.mastered,
        },
        errorMessage: '',
      };
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to process attempt in KT Engine';
      this.logger.error(
        `Error processing KT attempt: ${msg}`,
        error?.response?.data,
      );
      return {
        isError: true,
        data: null,
        errorMessage: msg,
      };
    }
  }

  // service สำหรับรัน corn job
  async triggerCalibration(): Promise<
    restfulResponse<{ status: string; message: string } | null>
  > {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/calibrate`),
      );
      return { isError: false, data: response.data, errorMessage: '' };
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to trigger calibration';
      this.logger.error(
        `Error triggering calibration: ${msg}`,
        error?.response?.data,
      );
      return { isError: true, data: null, errorMessage: msg };
    }
  }
}
