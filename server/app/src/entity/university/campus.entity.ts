import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
}