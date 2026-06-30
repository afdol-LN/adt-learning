import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Userprofile } from "./userprofile.entity";
import { Goal } from "./goal.entity";


@Entity('branch')
export class Branch{
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId : number;

    @Column()
    goalId : number;

    // @Column()
    // expGoalId: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    
    @OneToOne(()=> Userprofile)
    @JoinColumn({name: 'userId', referencedColumnName: 'id'})
    user: Userprofile;

    @OneToOne(()=> Goal)
    @JoinColumn({name: 'goalId', referencedColumnName: 'id'})
    goal: Goal;


}