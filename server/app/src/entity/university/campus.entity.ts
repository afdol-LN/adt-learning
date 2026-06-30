import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('campus')
export class Campus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    campus: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;
}