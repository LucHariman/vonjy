import { Body, Controller, Post } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('space')
  dataFromSpace(@Body() body: any): Observable<any> {
    if (body['className'] === 'InitPayload') {
      const clientId = body['clientId'];
      const clientSecret = body['clientSecret'];
      const serverUrl = body['serverUrl'];
      return this.appService.storeSpaceClient({ clientId, clientSecret, serverUrl });
    } else if (body['className'] === 'MessagePayload') {
      const clientId = body['clientId'];
      return this.appService.authenticateToSpace(clientId).pipe(
        map(session => {

          console.log(session)
        }),
      );
    }
  }
}
