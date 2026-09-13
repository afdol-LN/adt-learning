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
import { History } from './entity/history.entity';

// Session & Exercise entities
import { Session } from './entity/exerciseAndSession/session.entity';
import { Exercise } from './entity/exerciseAndSession/exercise.entity';
import { ExerciseChoice } from './entity/exerciseAndSession/exerciseChoice.entity';
import { SessionAndExercise } from './entity/exerciseAndSession/sessionAndExercise.entity';

// Goal & Skill entities
import { Goal } from './entity/goal.entity';
import { Skill } from './entity/skill.entity';
import { SkillPrerequisite } from './entity/skillPrerequisite.entity';
import { GoalSkillRequire } from './entity/goalSkillRequire.entity';

// AI draft entity
import { AiDraft } from './entity/aiDraft.entity';

// Controllers & Services
import { userController } from './controller/user.controller';
import { userProfileService } from './service/user.service';
import { branchController } from './controller/branch.controller';
import { branchService } from './service/branch.service';
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
import { goalController } from './controller/goal.controller';
import { goalService } from './service/goal.service';
import { historyController } from './controller/history.controller';
import { historyService } from './service/history.service';
import { ktController } from './controller/kt.controller';
import { ktService } from './service/kt.service';
import { sessionController } from './controller/session.controller';
import { sessionService } from './service/session.service';
import { aiDraftController } from './controller/aiDraft.controller';
import { aiDraftService } from './service/aiDraft.service';
import { LlmClient } from './libs/llm/llm.client';
import { Hash } from './libs/hash';
import { JwtService } from './libs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
//middleware
import { AuthMiddleWare } from './middleware/authMiddleWare';
import { MiddlewareConsumer } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { envFilePath } from './config/env-file';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    HttpModule,

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
      SessionAndExercise,
      Goal,
      Skill,
      SkillPrerequisite,
      GoalSkillRequire,
      History,
      AiDraft,
    ]),
  ],
  controllers: [
    AppController,
    userController,
    branchController,
    exerciseController,
    genderController,
    campusController,
    facultyController,
    majorController,
    authController,
    skillController,
    goalController,
    historyController,
    ktController,
    sessionController,
    aiDraftController,
  ],
  providers: [
    AppService,
    Logger,
    userProfileService,
    branchService,
    exerciseService,
    genderService,
    campusService,
    facultyService,
    majorService,
    authService,
    skillService,
    goalService,
    historyService,
    ktService,
    sessionService,
    aiDraftService,
    LlmClient,
    Hash,
    JwtService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleWare)
      .exclude(
        { path: '/userprofile/register', method: RequestMethod.POST },
        { path: '/authen/authen_request', method: RequestMethod.POST },
        { path: '/authen/access_request', method: RequestMethod.POST },
        { path: '/kt/(.*)', method: RequestMethod.ALL },
        { path: '/docs', method: RequestMethod.GET },
        { path: '/docs/(.*)', method: RequestMethod.GET },
        { path: '/docs-json', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
