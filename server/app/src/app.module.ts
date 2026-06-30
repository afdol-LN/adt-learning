import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { dataSourceOptions } from './config/data-source';
import { Gender } from './entity/gender.entity';
import { Userprofile } from './entity/userprofile.entity';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),

    TypeOrmModule.forFeature([
      Gender, 
      Userprofile,
      
    ]),
  ],
  controllers: [AppController],
  providers: [AppService,],
})
export class AppModule { }
