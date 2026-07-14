import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Userprofile } from './userprofile.entity';
import { SessionAndExercise } from './exerciseAndSession/sessionAndExercise.entity';

@Entity('history')
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: false })
  userId: number;

  @Index()
  @Column({ nullable: false })
  sessionAndExerciseId: number;

  @Column({ nullable: false, default: false })
  isCorrect: boolean;

  @Column({ nullable: false, default: false })
  isPretest: boolean;

  @Column({
    type: 'timestamp',
    nullable: false,
  })
  startTime: Date;

  @Column({
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  endTime: Date;

  @ManyToOne(() => Userprofile)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: Userprofile;

  @ManyToOne(() => SessionAndExercise)
  @JoinColumn({ name: 'sessionAndExerciseId', referencedColumnName: 'id' })
  sessionAndExercise: SessionAndExercise;
}
