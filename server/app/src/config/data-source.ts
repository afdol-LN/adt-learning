import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { envFilePath } from './env-file';

// โหลดค่าจากไฟล์ .env ให้พร้อมใช้งาน (จำเป็นมากสำหรับตอนรัน TypeORM CLI)
config({path : envFilePath});

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // ชี้เป้าหมายไปที่ไฟล์ Entity และ Migration ที่ถูก Build แล้ว (ในโฟลเดอร์ dist)
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],

  // synchronize ควรเป็น false เสมอเมื่อใช้ร่วมกับ Migration
  // และห้ามเปิดเป็น true ใน Production เด็ดขาดเพราะมันอาจลบตารางคุณทิ้งได้
  synchronize: false,

  // เปิด logging เพื่อดูคำสั่ง SQL ที่ TypeORM สร้างขึ้น (ช่วย Debug ได้ดีมาก)
  logging: false,

  // ตั้งค่า SSL สำหรับการเชื่อมต่อกับ Supabase / Cloud Database
  ssl:
    process.env.DATABASE_URL?.includes('supabase.co') ||
    process.env.DATABASE_URL?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
};

// Export ตัว DataSource เพื่อให้ TypeORM CLI นำไปใช้
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
