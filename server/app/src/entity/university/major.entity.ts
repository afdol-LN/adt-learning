import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Faculty } from './faculty.entity';

@Entity('major')
export class Major {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    unique: true,
  })
  majorId: string;

  @Column()
  major: string;

  @Column()
  facultyId: number;

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

  @Column({ nullable: false, default: false })
  isAboutCs: boolean;

  @ManyToOne(() => Faculty, (faculty) => faculty.majors)
  faculty: Faculty;
}
