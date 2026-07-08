import { Status } from 'src/enums/status.enum';
import { Column, Entity, ManyToMany, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Session } from './session.entity';
import { Skill } from '../skill.entity';

@Entity('exercise')
export class Exercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

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

  @Column({ name: 'skill_id', type: 'integer', nullable: true })
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

  @ManyToMany(
    () => Session,
    (session) => session.exercises,
  )
  sessions?: Session[];

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
  skill: Skill;
}
