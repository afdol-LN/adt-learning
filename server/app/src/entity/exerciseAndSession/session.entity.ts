import { Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('sessionExcercise')
export class SessionExercise {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => Exercise, (exercise) => exercise.sessions)
  @JoinTable()
  exercises: Exercise[];
}
