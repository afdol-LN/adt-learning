import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exercise } from './exercise.entity';
import { SessionAndExercise } from './sessionAndExercise.entity';

@Entity('session')
export class Session {
  @PrimaryGeneratedColumn({ name: 'session_id' })
  id: number;

  @Column({
    name: 'create_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @OneToMany(() => SessionAndExercise, sessionAndExercise => sessionAndExercise.session)
  exerciseRelate: SessionAndExercise[];
}
