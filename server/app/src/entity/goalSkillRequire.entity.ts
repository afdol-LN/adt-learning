import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Goal } from './goal.entity';
import { Skill } from './skill.entity';

@Entity('GoalskillRequire')
export class GoalSkillRequire {
  @PrimaryColumn({ name: 'goal_id', type: 'integer' })
  goalId: number;

  @PrimaryColumn({ name: 'skill_id', type: 'integer' })
  skillId: number;

  @Column({ name: 'level_require', type: 'integer', nullable: true })
  levelRequire: number;

  @ManyToOne(() => Goal, (goal) => goal.goalSkillRequire)
  @JoinColumn({ name: 'goal_id', referencedColumnName: 'id' })
  goal: Goal;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
  skill: Skill;
}
