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
      this.configService.get<string>('BKT_ENGINE_URL') ||
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
      const data = await this.postAttemptWithRetry(payload);
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

  /**
   * Render ตอบ 502/503/504 (หรือตัด connection) ระหว่างที่ engine กำลังตื่นหรือ restart
   * /kt/attempt เป็นการคำนวณล้วน ไม่มี state ฝั่ง engine จึงยิงซ้ำได้อย่างปลอดภัย
   * รอรวม ~70 วินาที (เท่าเวลาตื่นของ free plan) — frontend รอ /answer ได้ 180 วินาที
   */
  private static readonly ATTEMPT_RETRY_DELAYS_MS = [
    2_000, 4_000, 8_000, 16_000, 20_000, 20_000,
  ];

  private async postAttemptWithRetry(payload: object): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/kt/attempt`, payload),
        );
        return response.data;
      } catch (error) {
        const delay = ktService.ATTEMPT_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !ktService.isTransient(error)) throw error;
        this.logger.warn(
          `KT engine unavailable (${error?.response?.status ?? error?.code}), retry ${attempt + 1} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private static isTransient(error: any): boolean {
    const status = error?.response?.status;
    if (status) return status === 502 || status === 503 || status === 504;
    // ไม่มี response เลย = ต่อไม่ติด/ถูกตัดระหว่างทาง
    return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
      error?.code,
    );
  }

  /**
   * ปลุก engine ล่วงหน้า (Render free plan หลับเมื่อว่าง ~15 นาที และตื่นช้า ~70 วินาที)
   * fire-and-forget: ไม่รอผล ไม่โยน error — ถ้าปลุกไม่ขึ้น submitAttempt จะรายงานเองตอนส่งคำตอบ
   * ยิงไม่เกินครั้งละ WARM_UP_INTERVAL_MS ต่อ instance เพื่อไม่ให้นักเรียนหลายคนเปิด Home พร้อมกันแล้วยิงซ้ำ
   */
  private lastWarmUpAt = 0;
  private static readonly WARM_UP_INTERVAL_MS = 60_000;

  warmUp(): void {
    const now = Date.now();
    if (now - this.lastWarmUpAt < ktService.WARM_UP_INTERVAL_MS) return;
    this.lastWarmUpAt = now;
    firstValueFrom(
      this.httpService.get(`${this.baseUrl}/health`, { timeout: 120_000 }),
    ).catch((error) =>
      this.logger.warn(`KT engine warm-up failed: ${error?.message}`),
    );
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
