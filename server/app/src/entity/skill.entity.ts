import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Status } from "../enums/status.enum";
import { SkillPrerequisite } from "./skillPrerequisite.entity";

@Entity('skill')
export class Skill {
    @PrimaryGeneratedColumn({ name: 'skill_id' })
    skillId: number;

    @Column({
        nullable: false,
        unique: true,
    })
    skillCode : string

    @Column({ name: 'skills_name', type: 'varchar', length: 30 })
    skillsName: string;

    @Column({ name: 'tier', type: 'varchar', length: 10, nullable: true })
    tier: string;

    @Column({ 
        type : 'enum',
        enum : Status,
        default : Status.ACTIVE
    })
    status: string;

    @OneToMany(() => SkillPrerequisite, prequisite => prequisite.skill)
    skillPrequisite: SkillPrerequisite[]
}
