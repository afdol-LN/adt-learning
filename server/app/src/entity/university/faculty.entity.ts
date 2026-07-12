import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Campus } from "./campus.entity";
import { Major } from "./major.entity";

@Entity('faculty')
export class Faculty {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    faculty: string;

    @Column()
    campusId: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @ManyToOne(() => Campus, campus => campus.faculties)
    campus: Campus;

    @OneToMany(()=>Major, major=>major.faculty)
    majors: Major[];
}