import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('session')
export class Session {
  @PrimaryGeneratedColumn({ name: 'session_id' })
  id: number;

  @Column({ name: 'num_of_exercise', type: 'integer', nullable: true })
  numOfExercise: number;

  @Column({
    name: 'create_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ManyToMany(() => Exercise, (exercise) => exercise.sessions)
  @JoinTable({
    name: 'exercise_session',
    joinColumn: { name: 'session_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'exercise_id', referencedColumnName: 'id' },
  })
  exercises: Exercise[];
}
