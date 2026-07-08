import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Gender } from "./gender.entity";
import { UserRole } from "src/enums/user-role.enum";
import { Campus } from "./university/campus.entity";
import { Faculty } from "./university/faculty.entity";
import { Major } from "./university/major.entity";
import { Branch } from "./branch.entity";

@Entity('userprofile')
export class Userprofile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column()
    genderId: number;

    @Column()
    birthDate: string;

    // ข้อมูลการศึกษา
    @Column()
    campusId: number;
    
    @Column()
    facultyId: number;

    @Column()
    majorId: number;

    @Column({ name: 'username', nullable: true, length: 20 })
    username: string;

    @Column({ name: 'password', nullable: true, length: 20 })
    password: string;

    @Column({ name: 'status', type: 'integer', default: 1 })
    status: number;

    @Column({ name: 'behaviorScore', type: 'numeric', precision: 4, scale: 3, nullable: true })
    behaviorScore: number;

    @Column({ name: 'conceptMapState', type: 'jsonb', nullable: true })
    conceptMapState: any;

    @Column({ name: 'strengthWeaknessMatrix', type: 'jsonb', nullable: true })
    strengthWeaknessMatrix: any;

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

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role: UserRole;

    @OneToOne(() => Gender)
    @JoinColumn({ name: 'genderId', referencedColumnName: 'id' })
    gender: Gender;

    @OneToOne(() => Campus)
    @JoinColumn({ name: 'campusId', referencedColumnName: 'id' })
    campus: Campus;

    @OneToOne(() => Faculty)
    @JoinColumn({ name: 'facultyId', referencedColumnName: 'id' })
    faculty: Faculty;

    @OneToOne(() => Major)
    @JoinColumn({ name: 'majorId', referencedColumnName: 'id' })
    major: Major;

    @OneToMany(() => Branch, branch => branch.user)
    branches: Branch[];

    
}