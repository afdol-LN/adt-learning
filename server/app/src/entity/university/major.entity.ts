import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Faculty } from "./faculty.entity";

@Entity('major')
export class Major {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    major: string;

    @Column()
    facultyId: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @ManyToOne(() => Faculty, faculty=>faculty.majors)
    faculty: Faculty;
}