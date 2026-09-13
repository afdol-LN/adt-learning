import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { Status } from 'src/enums/status.enum';

export class GenerateDraftDto {
  entityType!: AiDraftEntityType;
  count!: number;
  /** เฉพาะ exercise */
  skillId?: number;
  skillLevel?: number;
  exerciseType?: 'CHOICE' | 'FILL_IN_BLANK' | 'MIXED';
  /** คำอธิบายเพิ่มเติมที่ admin พิมพ์เอง */
  instruction?: string;
}

export class RegenerateDraftDto {
  /** คำสั่งเพิ่มเติมตอนขอให้สร้างใหม่ เช่น "เปลี่ยนเป็นโจทย์ 2D array" */
  instruction?: string;
}

export class UpdateDraftPayloadDto {
  payload!: Record<string, any>;
}

export class ApproveDraftDto {
  /** admin เลือกเองว่าจะให้เข้าตารางจริงแบบเปิดใช้งานเลยหรือพักไว้ก่อน */
  status!: Status;
}

export class RejectDraftDto {
  note?: string;
}

export class FindDraftsQueryDto {
  status?: AiDraftStatus;
  entityType?: AiDraftEntityType;
  batchId?: string;
}

/** ผลลัพธ์ของการสั่งสร้าง 1 ครั้ง — บอกด้วยว่ามีกี่ข้อที่ถูกคัดทิ้งเพราะอะไร */
export class GenerateDraftResultDto {
  batchId!: string;
  created!: number;
  rejected!: { reason: string }[];
}
