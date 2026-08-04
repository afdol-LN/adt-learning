import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BktCornService{
    constructor(private readonly httpService : HttpService){

    }
    //ทุก ๆ สัปดาห์
    @Cron(CronExpression.EVERY_WEEK)
    async handleBktcalibration(){
        try{
        await firstValueFrom(
        //change domian after
        this.httpService.post('http://localhost:8000/kt/calibrate')
      ); 
       console.log('Successfully triggered BKT calibration.');
    }
    catch(error){
        console.error('Failed to trigger BKT calibration', error.message);
    }
    }
}