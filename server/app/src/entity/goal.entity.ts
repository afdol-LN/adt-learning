import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('goal')
export class Goal {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    goal: string;

    @Column({ name: 'goal_name', type: 'varchar', length: 20, nullable: true })
    goalName: string;

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

}