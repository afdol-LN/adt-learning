import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Campus } from './campus.entity';
import { Major } from './major.entity';

@Entity('faculty')
export class Faculty {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    unique: true,
  })
  facultyId: string;

  @Column()
  faculty: string;

  @Column()
  campusId: number;

  @Column({
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    type: 'timestamp',
  })
  createdAt: Date;

  @Column({
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    type: 'timestamp',
  })
  updatedAt: Date;

  @ManyToOne(() => Campus, (campus) => campus.faculties)
  campus: Campus;

  @OneToMany(() => Major, (major) => major.faculty)
  majors: Major[];
}
