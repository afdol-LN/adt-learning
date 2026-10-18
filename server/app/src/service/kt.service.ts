import { Injectable, Logger } from '@nestjs/common';
import { restfulResponse } from '../dto/restfulResponse';
import { AttemptRequestDto, AttemptResponseDto } from '../dto/kt/kt.dto';
import { updateMastery } from '../libs/bkt/ktIdem';

/**
 * อัปเดต P(L) ด้วย KT-IDEM ในตัว NestJS เอง (เดิมยิงไป btk-engine POST /kt/attempt)
 * การ calibrate ค่า pL0/pT/pG/pS ยังใช้ pyBKT — รัน btk-engine/app/script/calibrate.py เองบนเครื่อง
 */
@Injectable()
export class ktService {
  private readonly logger = new Logger(ktService.name);

  async submitAttempt(
    dto: AttemptRequestDto,
  ): Promise<restfulResponse<AttemptResponseDto | null>> {
    try {
      const res = updateMastery(dto);
      this.logger.log(
        `BKT update | correct=${dto.isCorrect} pL ${res.pLPrior.toFixed(3)} -> ${res.pLPosterior.toFixed(3)} -> ${res.pLNext.toFixed(3)} | predicted_next=${res.predictedCorrectProbNext.toFixed(3)} mastered=${res.mastered}`,
      );
      return { isError: false, data: res, errorMessage: '' };
    } catch (error) {
      const msg = error?.message || 'Failed to process attempt';
      this.logger.error(`Error processing KT attempt: ${msg}`);
      return { isError: true, data: null, errorMessage: msg };
    }
  }
}
