import { Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { dataSourceOptions } from './config/data-source';
import { Logger } from '@nestjs/common';
// University entities
import { Campus } from './entity/university/campus.entity';
import { Faculty } from './entity/university/faculty.entity';
import { Major } from './entity/university/major.entity';

// User Profile entities
import { Gender } from './entity/gender.entity';
import { Userprofile } from './entity/userprofile.entity';
import { Branch } from './entity/branch.entity';

// Session & Exercise entities
import { Session } from './entity/exerciseAndSession/session.entity';
import { Exercise } from './entity/exerciseAndSession/exercise.entity';
import { ExerciseChoice } from './entity/exerciseAndSession/exerciseChoice.entity';

// Goal & Skill entities
import { Goal } from './entity/goal.entity';
import { Skill } from './entity/skill.entity';
import { SkillPrerequisite } from './entity/skillPrerequisite.entity';
import { GoalSkillRequire } from './entity/goalSkillRequire.entity';

// Controllers & Services
import { userController } from './controller/user.controller';
import { userProfileService } from './service/user.service';
import { exerciseController } from './controller/exercise.controller';
import { exerciseService } from './service/exercise.service';
import { genderController } from './controller/gender.controller';
import { genderService } from './service/gender.service';
import { campusController } from './controller/campus.controller';
import { campusService } from './service/campus.service';
import { facultyController } from './controller/faculty.controller';
import { facultyService } from './service/faculty.service';
import { majorController } from './controller/major.controller';
import { majorService } from './service/major.service';
import { authService } from './service/auth.service';
import { authController } from './controller/auth.controller';
import { skillController } from './controller/skill.controller';
import { skillService } from './service/skill.service';
import { ktController } from './controller/kt.controller';
import { ktService } from './service/kt.service';
import { Hash } from './libs/hash';
import { JwtService } from './libs/jwt';
import { HttpModule } from '@nestjs/axios';

//middleware
import { AuthMiddleWare } from './middleware/authMiddleWare';
import { MiddlewareConsumer } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    // HttpModule,

    TypeOrmModule.forFeature([
      Campus,
      Faculty,
      Major,  
      Gender,
      Userprofile,
      Branch,
      Session,
      Exercise,
      ExerciseChoice,
      Goal,
      Skill,
      SkillPrerequisite,
      GoalSkillRequire,
    ]),
  ],
  controllers: [
    AppController,
    userController,
    exerciseController,
    genderController,
    campusController,
    facultyController,
    majorController,
    authController,
    skillController,
    // ktController,
  ],
  providers: [
    AppService,
    Logger,
    userProfileService,
    exerciseService,
    genderService,
    campusService,
    facultyService,
    majorService,
    authService,
    skillService,
    // ktService,
    Hash,
    JwtService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // consumer
    //   .apply(AuthMiddleWare)
    //   .exclude(
    //     { path: '/userprofile/register', method: RequestMethod.POST },
    //     { path: '/authen/authen_request', method: RequestMethod.POST },
    //     { path: '/authen/access_request', method: RequestMethod.POST },
    //     { path: '/kt/(.*)', method: RequestMethod.ALL },
    //     // { path: '/userprofile/admin/user_list', method: RequestMethod.GET },
    //   )
    //   .forRoutes('*');
  }
}
