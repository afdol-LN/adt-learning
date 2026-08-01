import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { restfulResponse } from '../dto/restfulResponse';
import {
  SkillRegisterDto,
  ItemRegisterDto,
  AttemptRequestDto,
  AttemptResponseDto,
  MasteryResponseDto,
} from '../dto/kt/kt.dto';

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

  async registerSkill(
    dto: SkillRegisterDto,
  ): Promise<
    restfulResponse<{ skillId: string; pL0: number; pT: number } | null>
  > {
    try {
      const payload = {
        skill_id: dto.skillId,
        p_l0: dto.pL0,
        p_t: dto.pT,
      };
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/skill`, payload),
      );
      const data = response.data;
      return {
        isError: false,
        data: {
          skillId: data.skill_id,
          pL0: data.p_l0,
          pT: data.p_t,
        },
        errorMessage: '',
      };
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to register skill in KT Engine';
      this.logger.error(
        `Error registering skill: ${msg}`,
        error?.response?.data,
      );
      return {
        isError: true,
        data: null,
        errorMessage: msg,
      };
    }
  }

  async registerItem(dto: ItemRegisterDto): Promise<
    restfulResponse<{
      itemId: string;
      skillId: string;
      pG: number;
      pS: number;
      difficultyLabel: number;
    } | null>
  > {
    try {
      const payload = {
        item_id: dto.itemId,
        skill_id: dto.skillId,
        p_g: dto.pG,
        p_s: dto.pS,
        difficulty_label: dto.difficultyLabel ?? 0,
      };
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/item`, payload),
      );
      const data = response.data;
      return {
        isError: false,
        data: {
          itemId: data.item_id,
          skillId: data.skill_id,
          pG: data.p_g,
          pS: data.p_s,
          difficultyLabel: data.difficulty_label,
        },
        errorMessage: '',
      };
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to register item in KT Engine';
      this.logger.error(
        `Error registering item: ${msg}`,
        error?.response?.data,
      );
      return {
        isError: true,
        data: null,
        errorMessage: msg,
      };
    }
  }

  async submitAttempt(
    dto: AttemptRequestDto,
  ): Promise<restfulResponse<AttemptResponseDto | null>> {
    try {
      const payload = {
        student_id: dto.studentId,
        item_id: dto.itemId,
        correct: dto.correct,
      };
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/kt/attempt`, payload),
      );
      const data = response.data;
      return {
        isError: false,
        data: {
          studentId: data.student_id,
          itemId: data.item_id,
          skillId: data.skill_id,
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

  async getMastery(
    studentId: string,
    skillId: string,
  ): Promise<restfulResponse<MasteryResponseDto | null>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/kt/mastery/${studentId}/${skillId}`,
        ),
      );
      const data = response.data;
      return {
        isError: false,
        data: {
          studentId: data.student_id,
          skillId: data.skill_id,
          pL: data.p_l,
          mastered: data.mastered,
        },
        errorMessage: '',
      };
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to fetch mastery from KT Engine';
      this.logger.error(
        `Error fetching mastery: ${msg}`,
        error?.response?.data,
      );
      return {
        isError: true,
        data: null,
        errorMessage: msg,
      };
    }
  }
}
