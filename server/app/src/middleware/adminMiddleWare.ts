import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';
@Injectable()
export class AdminMiddleware implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenRequestDto>();
    const user = request.user;
    // ตรวจสอบว่ามีข้อมูล user และ userRole เป็น 'admin' หรือไม่
    if (!user || user.userRole !== 'admin') {
      throw new ForbiddenException('Access denied: Admin permission required');
    }
    return true; // อนุญาตให้ผ่าน
  }
}
