import { Status } from 'src/enums/status.enum';
import { ExerciseType } from 'src/enums/exercise-type.enum';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { Skill } from '../skill.entity';
import { ExerciseChoice } from './exerciseChoice.entity';
import { SessionAndExercise } from './sessionAndExercise.entity';
@Entity('exercise')
export class Exercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Index()
  @Column()
  level: number;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.ACTIVE,
  })
  status: Status;

  @Column({ name: 'expect_time', type: 'integer', nullable: true })
  expectTime: number;

  @Index()
  @Column({ name: 'skill_id', type: 'integer' })
  skillId: number;

  @Column({ name: 'skill_level', type: 'integer' })
  skillLevel: number;

  @Column({
    type: 'enum',
    enum: ExerciseType,
    default: ExerciseType.CHOICE,
  })
  type: ExerciseType;

  @Column({ default: 0.1, name: 'pG', type: 'float' })
  pG: number;

  @Column({ default: 0.1, name: 'pS', type: 'float' })
  pS: number;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  /** โค้ดที่ต้องแสดงให้นักศึกษาดูก่อนตอบ — โจทย์ที่ไม่ต้องใช้โค้ดปล่อยเป็น null */
  @Column({ type: 'text', nullable: true })
  code: string | null;

  /** ภาษาของ code สำหรับ syntax highlight — ดู CodeLanguage enum */
  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', nullable: true })
  fillInBlank: string | null;

  @Column({ nullable: true, default: 'NO' })
  isCasesensitive: string;

  @OneToMany(
    () => SessionAndExercise,
    (sessionAndExercise) => sessionAndExercise.exercise,
  )
  sessionRelate: SessionAndExercise[];

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
  skill: Skill;

  @OneToMany(() => ExerciseChoice, (exerciseChoice) => exerciseChoice.exercise)
  exerciseChoices?: ExerciseChoice[];
}
