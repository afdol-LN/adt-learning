import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';
import { SessionAndExercise } from './sessionAndExercise.entity';
import { Branch } from '../branch.entity';
import { Skill } from '../skill.entity';

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

  @Column({ nullable: true })
  branchId: number;

  @Column({ nullable: true })
  skillId: number;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  stopReason: string | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId', referencedColumnName: 'id' })
  branch: Branch;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId', referencedColumnName: 'skillId' })
  skill: Skill;

  @OneToMany(
    () => SessionAndExercise,
    (sessionAndExercise) => sessionAndExercise.session,
  )
  exerciseRelate: SessionAndExercise[];
}
