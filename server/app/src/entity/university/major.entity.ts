import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
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

    @OneToOne(() => Faculty)
    @JoinColumn({ name: 'facultyId', referencedColumnName: 'id' })
    faculty: Faculty;
}