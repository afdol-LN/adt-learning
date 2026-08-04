import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Userprofile } from './userprofile.entity';
import { SessionAndExercise } from './exerciseAndSession/sessionAndExercise.entity';
import { Branch } from './branch.entity';

@Entity('history')
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: false })
  branchId: number;

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

  @Column({ type: 'varchar', nullable: true })
  chosenAnswer: string;

  @ManyToOne(() => Branch, (branch) => branch.history)
  @JoinColumn({ name: 'branchId', referencedColumnName: 'id' })
  branch: Branch;

  @ManyToOne(
    () => SessionAndExercise,
    (sessionAndExercise) => sessionAndExercise.history,
  )
  @JoinColumn({ name: 'sessionAndExerciseId', referencedColumnName: 'id' })
  sessionAndExercise: SessionAndExercise;
}
