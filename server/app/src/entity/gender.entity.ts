import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Userprofile } from "./userprofile.entity";
@Entity('gender')

export class Gender {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    gender: string;

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