import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exercise } from './exercise.entity';
import { Session } from './session.entity';
import { History } from '../history.entity';

@Entity('sessionAndExercise')
export class SessionAndExercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: false })
  exerciseId: number;

  @Index()
  @Column({ nullable: false })
  sessionId: number;

  @ManyToOne(() => Exercise, exercise => exercise.sessionRelate)
  @JoinColumn({ name: 'exerciseId', referencedColumnName: 'id' })
  exercise: Exercise;

  @ManyToOne(() => Session, session => session.exerciseRelate)
  @JoinColumn({ name: 'sessionId', referencedColumnName: 'id' })
  session: Session;

  @OneToMany(() => History, history => history.sessionAndExercise)
  history: History[];
}
