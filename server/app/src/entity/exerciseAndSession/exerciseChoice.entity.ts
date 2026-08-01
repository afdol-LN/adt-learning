import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('exerciseChoice')
export class ExerciseChoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'exerciseId', nullable: true })
  exerciseId: number;

  @Column({ name: 'script', type: 'varchar', length: 15, nullable: true })
  script: string;

  @Column({ name: 'isAnswer' })
  isAnswer: boolean;

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

  @ManyToOne(() => Exercise, (exercise) => exercise.exerciseChoices)
  @JoinColumn({ name: 'exerciseId', referencedColumnName: 'id' })
  exercise: Exercise;
}
