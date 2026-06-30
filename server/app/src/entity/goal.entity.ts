import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity('goal')
export class Goal{
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    goal: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    
}
