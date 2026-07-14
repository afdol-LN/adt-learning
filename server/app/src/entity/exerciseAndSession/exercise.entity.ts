import { Status } from 'src/enums/status.enum';
import { Column, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
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
  @Column({ name: 'skill_id', type: 'integer'})
  skillId: number;

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

  @Column({nullable: true})
  fillInBlank : string

  @Column({nullable: true, default : "NO"})
  isCasesensitive: string;

  @OneToMany(()=> SessionAndExercise, sessionAndExercise => sessionAndExercise.exerciseId)
  sessionRelate: SessionAndExercise[];

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
  skill: Skill;

  @OneToMany(() => ExerciseChoice, exerciseChoice => exerciseChoice.exercise)
  exerciseChoices?: ExerciseChoice[];
}
