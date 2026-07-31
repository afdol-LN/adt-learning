import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Branch } from "./branch.entity";
import { GoalSkillRequire } from "./goalSkillRequire.entity";
import { Status } from "../enums/status.enum";

@Entity('goal')
export class Goal {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    goal: string;

    @Column({ name: 'goal_description', type: 'varchar', length: 255, nullable: true })
    goalDescription: string;

    @Column({
        type: 'enum',
        enum: Status,
        default: Status.ACTIVE,
    })
    status: string;

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

    @OneToMany(() => Branch, branch => branch.goal)
    branches: Branch[];

    @OneToMany(() => GoalSkillRequire, require => require.goal)
    goalSkillRequire: GoalSkillRequire[];

}