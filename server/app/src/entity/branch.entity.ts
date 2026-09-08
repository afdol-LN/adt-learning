import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Userprofile } from './userprofile.entity';
import { Goal } from './goal.entity';
import { History } from './history.entity';
import { ConceptMapState } from '../libs/bkt/masteryState';
@Entity('branch')
export class Branch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  goalId: number;

  @Column({ name: 'exp_for_goal', type: 'integer', nullable: true })
  expForGoal: number;

  @Column({ default: false })
  isAlreadyPretest: boolean;

  // BKT mastery for THIS branch only (skillId -> ConceptMapEntry). Deliberately
  // per-branch and not per-user: the same skill can be required by two different
  // goals, and progress made under one goal must not leak into the other.
  @Column({ name: 'conceptMapState', type: 'jsonb', nullable: true })
  conceptMapState: ConceptMapState | null;

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

  @ManyToOne(() => Userprofile, (userprofile) => userprofile.branches)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: Userprofile;

  @ManyToOne(() => Goal, (goal) => goal.branches)
  @JoinColumn({ name: 'goalId', referencedColumnName: 'id' })
  goal: Goal;

  @OneToMany(() => History, (history) => history.branch)
  history: History[];
}
