import { Injectable, Logger } from '@nestjs/common';
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
      const allUsers = await this.userReponsitory.find({
        where : {
          status : "active"
        }
      });
      // วน loop hash username ทีละคน แล้วเทียบ
      console.log('data before hashed : username',this.hash.getSalt(),today)
      
      const result = allUsers.find((user) => {
        console.log("username : ", user.username)
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
          errorMessage: 'Not found user',
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
    } catch (error : any) {
      response = {
        isError: true,
        errorMessage: error.message,
      };
    } finally {
      return response;
    }
  }
  async accessRequest(authenToken: String, authenSignature: String) {
    // authenSignature = username + SAH256(password) + authentoken
    var response;
    Logger.log("this is authenToken", authenToken);
    Logger.log("this is authenSignature", authenSignature);
    try {
      const AllUser = await this.userReponsitory.find({
        relations: {
          branches: true,
        },
      });
      const result = AllUser.find((user) => {
        const hashed = this.hash.hashSha256(
          user.username + user.password + authenToken,
        );
        return hashed == authenSignature; // ← return boolean แค่นี้พอ
      });

      if (!result) {
        response = {
          isError: true,
          errorMessage: 'Password or token incorrect',
        };
      } else {
        const payload = {
          userName: result.username,
          userRole: result.role,
          userId: result.id,
        };
        const accessToken = this.jwtservice.generateToken(payload);
        const branchIds = result.branches && Array.isArray(result.branches) && result.branches.length > 0
          ? result.branches.map((b) => b.id)
          : null;
        response = {
          isError: false,
          data: {
            userName: result.username,
            fullName: result.fullName,
            userRole: result.role,
            userId: result.id,
            accessToken: accessToken,
            branchId: branchIds,
          },
        };
      }
    } catch (error: any) {
      response = {
        isError: true,
        errorMessage: error.message,
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
          errorMessage: 'Username already exists',
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
            errorMessage: 'Register failed',
          };
        }
      }
    } catch (error : any) {
      response = {
        isError: true,
        errorMessage: error.message,
      };
    } finally {
      return response;
    }
  }
}
