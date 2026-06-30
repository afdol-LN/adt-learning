import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Userprofile } from "./userprofile.entity";
@Entity('gender')

export class Gender {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    gender: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;
}