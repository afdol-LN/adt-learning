import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Skill } from "./skill.entity";

@Entity('skills_prerequisite')
export class SkillPrerequisite {
    @PrimaryColumn({ name: 'skill_id', type: 'integer' })
    skillId: number;

    @PrimaryColumn({ name: 'prerequisite_skill', type: 'integer' })
    prerequisiteSkillId: number;

    @Column({ name: 'Prerequisite_level', type: 'integer', nullable: true })
    prerequisiteLevel: number;

    @ManyToOne(() => Skill)
    @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
    skill: Skill;
 
    @ManyToOne(() => Skill)
    @JoinColumn({ name: 'prerequisite_skill', referencedColumnName: 'skillId' })
    prerequisiteSkill: Skill;
}
