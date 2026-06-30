import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Campus } from "./campus.entity";

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

    @OneToOne(() => Campus)
    @JoinColumn({ name: 'campusId', referencedColumnName: 'id' })
    campus: Campus;
}