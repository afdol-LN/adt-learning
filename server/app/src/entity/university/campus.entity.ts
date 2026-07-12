import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Faculty } from "./faculty.entity";

@Entity('campus')
export class Campus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    campus: string;

    @Column({
        default: () => 'CURRENT_TIMESTAMP',
        type: 'timestamp',
    })
    createdAt: Date;

    @Column({
        default: () => 'CURRENT_TIMESTAMP',
        type: 'timestamp',
    })
    updatedAt: Date;

    @OneToMany(()=>Faculty, faculty=>faculty.campus)
    faculties: Faculty[];
}