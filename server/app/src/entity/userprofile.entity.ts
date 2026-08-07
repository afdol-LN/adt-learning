import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { Gender } from './gender.entity';
import { UserRole } from 'src/enums/user-role.enum';
import { Campus } from './university/campus.entity';
import { Faculty } from './university/faculty.entity';
import { Major } from './university/major.entity';
import { Branch } from './branch.entity';
import { Status } from '../enums/status.enum';

@Entity('userprofile')
export class Userprofile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fullName', length: 100 })
  fullName: string;

  //เพิ่ม default = 1
  @Column({ default: 1 })
  genderId: number;

  //แก้ String -> Date
  @Column()
  birthDate: string;

  // ข้อมูลการศึกษา
  @Column({ nullable: true })
  campusId: number;

  @Column({ nullable: true })
  facultyId: number;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  majorId: number;

  @Column({ name: 'username', nullable: true, length: 20 })
  username: string;

  @Column({ name: 'password', nullable: true, length: 80 })
  password: string;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.ACTIVE,
  })
  status: string;

  // ************* ด๊อลงงงงงงงงงงงงงงงงงงงงงงงงงง
  @Column({
    name: 'behaviorScore',
    type: 'numeric',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  behaviorScore: number;

  @Column({ name: 'conceptMapState', type: 'jsonb', nullable: true })
  conceptMapState: any;
  // conceptMapState format data
  // {
  //   "1": {
  //   "pL": 0.50,
  //   "progress": 53,
  //   "status": "unlocked",
  //   "attemptCount": 4,
  //   "level" : 1
  //   },
  //   "1": {
  //   "pL": 0.4,
  //   "progress": 40,
  //   "status": "unlocked",
  //   "attemptCount": 3,
  //   "level" : 2
  //   },
  //    "2": {
  //   "pL": 0.96,
  //   "progress": 100,
  //   "status": "completed",
  //   "attemptCount": 12,
  //   "level": 2
  //    },
  //    "3": {
  //    "pL": 0.10,
  //    "progress": 11,
  //    "status": "locked",
  //    "attemptCount": 0,
  //   "level": 2
  //    },
  // }

  @Column({ name: 'strengthWeaknessMatrix', type: 'jsonb', nullable: true })
  strengthWeaknessMatrix: any;
  // ******************

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

  @ManyToOne(() => Gender)
  @JoinColumn({ name: 'genderId', referencedColumnName: 'id' })
  gender: Gender;

  @ManyToOne(() => Campus)
  @JoinColumn({ name: 'campusId', referencedColumnName: 'id' })
  campus: Campus;

  @ManyToOne(() => Faculty)
  @JoinColumn({ name: 'facultyId', referencedColumnName: 'id' })
  faculty: Faculty;

  @ManyToOne(() => Major)
  @JoinColumn({ name: 'majorId', referencedColumnName: 'id' })
  major: Major;

  @OneToMany(() => Branch, (branch) => branch.user)
  branches: Branch[];
}
