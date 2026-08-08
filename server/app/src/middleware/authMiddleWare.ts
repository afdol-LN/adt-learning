import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthenRequestDto } from 'src/dto/userprofile.dto';
import { JwtService } from '../libs/jwt';
@Injectable()
export class AuthMiddleWare implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: AuthenRequestDto, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided or invalid format');
    }
    const token = authHeader.split(' ')[1];
    const decoded = this.jwtService.verifyToken(token);
    if (!decoded) {
      throw new UnauthorizedException('Invalid token');
    }
    req.user = decoded;
    next();
  }
}
