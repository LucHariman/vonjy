import { Body, Controller, Get, Post } from '@nestjs/common';
import { catchError, Observable, of, switchMap } from 'rxjs';

import { AppService } from './app.service';
import { StackExchangeService } from './stack-exchante';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly stackExchange: StackExchangeService,
  ) {}

  @Post('space')
  dataFromSpace(@Body() body: any): Observable<any> {
    if (body['className'] === 'InitPayload') {
      const clientId = body['clientId'];
      const clientSecret = body['clientSecret'];
      const serverUrl = body['serverUrl'];
      return this.appService.storeSpaceClient({ clientId, clientSecret, serverUrl });
    } else if (body['className'] === 'MessagePayload') {
      const clientId = body['clientId'];
      const message: string = body['message'];
      const channelId: string = message['channelId'];
      const messageText: string = message['body']['text'];

      return this.appService.authenticateToSpace(clientId).pipe(
        switchMap(session => {
          const siteSlug = (messageText.match(/(?:^|\W)site:(\w+)(?:\W|$)/) || [])[1] || 'stackoverflow';
          const question = messageText.replace(/(?:^|\W)site:(\w+)(?:\W|$)/g, ' ');

          return this.stackExchange.searchAnswer(question, siteSlug).pipe(
            catchError(error => {
              console.error(error);
              return of(`Unfortunately I didn't find an answer for you :face_with_rolling_eyes:`);
            }),
            switchMap(answer => this.appService.sendMessageToSpaceChannel(session, channelId, answer))
          )
        })
      );
    }
  }
}
