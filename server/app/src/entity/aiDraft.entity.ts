import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  AiDraftEntityType,
  AiDraftStatus,
} from 'src/enums/ai-draft.enum';

/**
 * ร่าง (draft) ที่ LLM สร้างขึ้น รอให้ admin ตรวจก่อนบันทึกลงตารางจริง
 * payload เก็บเป็น jsonb ที่มีหน้าตาตรงกับ CreateExerciseDto /
 * CreateSkillWithPrerequisiteDto / CreateGoalWithSkillRequireDto ตาม entityType
 */
@Entity('aiDraft')
export class AiDraft {
  @PrimaryGeneratedColumn()
  id: number;

  /** uuid ต่อการกด Generate 1 ครั้ง ใช้จัดกลุ่มร่างที่มาจากคำสั่งเดียวกัน */
  @Index()
  @Column({ name: 'batch_id', type: 'varchar', length: 36 })
  batchId: string;

  @Index()
  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: AiDraftEntityType,
  })
  entityType: AiDraftEntityType;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Index()
  @Column({
    type: 'enum',
    enum: AiDraftStatus,
    default: AiDraftStatus.PENDING,
  })
  status: AiDraftStatus;

  /** คำสั่งที่ admin พิมพ์ตอนสั่งสร้าง เก็บไว้ให้ regenerate ใช้ซ้ำ */
  @Column({ type: 'text', nullable: true })
  prompt: string | null;

  /** พารามิเตอร์ตอนสั่งสร้าง (skillId, skillLevel, exerciseType) ใช้ตอน regenerate */
  @Column({ name: 'generate_params', type: 'jsonb', nullable: true })
  generateParams: Record<string, any> | null;

  /** ชื่อ model ที่สร้างร่างนี้ ไว้ตรวจย้อนหลัง */
  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  /** id ของแถวจริงหลัง approve */
  @Column({ name: 'approved_entity_id', type: 'integer', nullable: true })
  approvedEntityId: number | null;

  /** เหตุผลตอน reject หรือคำสั่งตอน regenerate ครั้งล่าสุด */
  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
