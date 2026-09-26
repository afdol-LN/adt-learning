import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Userprofile } from './userprofile.entity';

// หนึ่งแถวต่อการ login สำเร็จหนึ่งครั้ง — ใช้แสดงใน timeline ประวัติของ admin
@Entity('loginLog')
export class LoginLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: false })
  userId: number;

  @Index()
  @Column({
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  loggedInAt: Date;

  @ManyToOne(() => Userprofile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: Userprofile;
}
