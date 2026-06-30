import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn } from "typeorm";
import { Exercise } from "./exercise.entity";

@Entity('exerciseChoice')
export class ExerciseChoice{
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(()=> Exercise)
    @JoinColumn({name: 'exerciseId', referencedColumnName: 'id'})
    exerciseId: number;

    @Column()
    isAnswer: boolean;

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
