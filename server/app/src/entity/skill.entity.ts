import { Column, Entity, PrimaryColumn } from "typeorm";
import { Status } from "../enums/status.enum";

@Entity('skill')
export class Skill {
    @PrimaryColumn({ name: 'skill_id', type: 'integer' })
    skillId: number;

    @Column({ name: 'skills_name', type: 'varchar', length: 30 })
    skillsName: string;

    @Column({ name: 'tier', type: 'varchar', length: 1, nullable: true })
    tier: string;

    @Column({ 
        type : 'enum',
        enum : Status,
        default : Status.ACTIVE
    })
    status: string;
}
