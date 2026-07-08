import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity('skill')
export class Skill {
    @PrimaryColumn({ name: 'skill_id', type: 'integer' })
    skillId: number;

    @Column({ name: 'skills_name', type: 'varchar', length: 30 })
    skillsName: string;

    @Column({ name: 'tier', type: 'varchar', length: 1, nullable: true })
    tier: string;

    @Column({ name: 'status', type: 'integer', default: 1 })
    status: number;
}
