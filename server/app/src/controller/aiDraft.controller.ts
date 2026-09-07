import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import type { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import {
  ApproveDraftDto,
  GenerateDraftDto,
  GenerateDraftResultDto,
  RegenerateDraftDto,
  RejectDraftDto,
  UpdateDraftPayloadDto,
} from 'src/dto/aiDraft.dto';
import { aiDraftService } from 'src/service/aiDraft.service';

/**
 * ทุก endpoint ที่นี่เป็นของ admin เท่านั้น จึงติด AdminMiddleware ที่ระดับ class
 *
 * หมายเหตุ: ห้ามเพิ่ม /ai-draft เข้าไปใน exclude() ของ AuthMiddleWare ใน app.module.ts
 * เพราะ AdminMiddleware อ่าน req.user ที่ AuthMiddleWare เป็นคนใส่ให้ ถ้า exclude
 * ไว้ req.user จะว่างและ guard จะบล็อกทุกคน (เป็นบั๊กที่เกิดกับ /kt/* อยู่ตอนนี้)
 */
@ApiTags('AI Draft')
@Controller('/ai-draft')
@UseGuards(AdminMiddleware)
export class aiDraftController {
  constructor(private readonly aiDraftService: aiDraftService) {}

  /** สั่งให้ AI ร่างรายการใหม่เป็นชุด */
  @Post('/generate')
  async generate(
    @Body() dto: GenerateDraftDto,
    @Req() req: AuthenRequestDto,
  ): Promise<GenerateDraftResultDto> {
    return await this.aiDraftService.generate(dto, req.user?.userId ?? null);
  }

  @Get()
  async findAll(
    @Query('status') status?: AiDraftStatus,
    @Query('entityType') entityType?: AiDraftEntityType,
    @Query('batchId') batchId?: string,
  ): Promise<AiDraft[]> {
    return await this.aiDraftService.findAll({ status, entityType, batchId });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AiDraft> {
    return await this.aiDraftService.findOneOrFail(id);
  }

  /** ขอให้ AI สร้างรายการนี้ใหม่ พร้อมคำสั่งเพิ่มเติมได้ */
  @Post(':id/regenerate')
  async regenerate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegenerateDraftDto,
  ): Promise<AiDraft> {
    return await this.aiDraftService.regenerateOne(id, dto?.instruction);
  }

  /** admin แก้เนื้อหาร่างเอง */
  @Put(':id')
  async updatePayload(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDraftPayloadDto,
  ): Promise<AiDraft> {
    return await this.aiDraftService.updatePayload(id, dto?.payload);
  }

  /** อนุมัติ แล้วบันทึกลงตารางจริงด้วย status ที่ admin เลือก */
  @Post(':id/approve')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveDraftDto,
  ): Promise<AiDraft> {
    return await this.aiDraftService.approve(id, dto?.status);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDraftDto,
  ): Promise<AiDraft> {
    return await this.aiDraftService.reject(id, dto?.note);
  }
}
