import { Injectable } from '@nestjs/common';
import { BaseService } from './base.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Userprofile } from 'src/entity/userprofile.entity';
import { Repository } from 'typeorm';
import { Hash } from 'src/libs/hash';
import { DateFormat } from 'src/libs/date-format';
import { JwtService } from 'src/libs/jwt';
import { access } from 'fs';
import { CreateUserprofileDto } from 'src/dto/userprofile.dto';
@Injectable()
export class authService extends BaseService<Userprofile> {
  private readonly hash: Hash = new Hash();
  private readonly jwtservice: JwtService = new JwtService();
  constructor(
    @InjectRepository(Userprofile)
    private readonly userReponsitory: Repository<Userprofile>,
  ) {
    super(userReponsitory);''
  }
  async authenRequest(authenRequest: String) {
    var response;
    const today: string = DateFormat.toDateString();
    try {
      // ดึง userprofile ทุกคนมาก่อน
      const allUsers = await this.userReponsitory.find();
      // วน loop hash username ทีละคน แล้วเทียบ
      const result = allUsers.find((user) => {
        const hashed = this.hash.hashWithSaltAndDate(
          user.username,
          this.hash.getSalt(),
          today,
        );
        console.log('match', hashed, 'with authenRequest', authenRequest);
        return hashed == authenRequest; // authenRequest คือ hashed string ที่ส่งมา
      });
      if (!result) {
        console.log(result)
        response = {
          isError: true,
          erroMessage: 'Not found user',
        };
      } else {
        const payload = {
          username: result.username,
        };
        const authenToken = this.jwtservice.generateToken(payload);
        response = {
          isError: false,
          data: {
            userName: result.username,
            authenToken: authenToken,
          },
        };
      }
    } catch (error) {
      response = {
        isError: true,
        erroMessage: error.message,
      };
    } finally {
      return response;
    }
  }
  async accessRequest(authenToken: String, authenSignature: String) {
    // authenSignature = username + SAH256(password) + authentoken
    var response;
    try {
      const AllUser = await this.userReponsitory.find();
      const result = AllUser.find((user) => {
        const hashed = this.hash.hashSha256(
          user.username + user.password + authenToken,
        );
        return hashed == authenSignature; // ← return boolean แค่นี้พอ
      });

      if (!result) {
        response = {
          isError: true,
          erroMessage: 'Password or token incorrect',
        };
      } else {
        const payload = {
          userName: result.username,
          userRole: result.role,
          userId: result.id,
        };
        const accessToken = this.jwtservice.generateToken(payload);
        response = {
          isError: false,
          data: {
            userName: result.username,
            userRole: result.role,
            userId: result.id,
            accessToken: accessToken,
          },
        };
      }
    } catch (error) {
      response = {
        isError: true,
        errorMesage: error.message,
      };
    } finally {
      return response;
    }
  }

  //register
  async register(userprofile: CreateUserprofileDto) {
    var response;
    try {
      // check username duplicate
      const checkUser = await this.userReponsitory.findOne({
        where: { username: userprofile.username },
      });
      if (checkUser) {
        response = {
          isError: true,
          erroMessage: 'Username already exists',
        };
      } else {
        const hashPassword = this.hash.hashSha256(userprofile.password);
        userprofile.password = hashPassword;
        const result = await this.create(userprofile);
        if (result) {
          const accessToken = this.jwtservice.generateToken({
            userName: result.fullName,
            userRole: result.role,
            userId: result.id,
          });
          response = {
            isError: false,
            data: {
              userId: result.id,
              userName: result.fullName,
              userRole: result.role,
              accessToken: accessToken,
            },
          };
        } else {
          response = {
            isError: true,
            erroMessage: 'Register failed',
          };
        }
      }
    } catch (error) {
      response = {
        isError: true,
        erroMessage: error.message,
      };
    } finally {
      return response;
    }
  }
}
