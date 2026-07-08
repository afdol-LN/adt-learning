import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { dataSourceOptions } from './config/data-source';

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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),

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
  controllers: [AppController, userController, exerciseController],
  providers: [AppService, userProfileService, exerciseService],
})
export class AppModule {}
