import { Body, Controller, Post } from '@nestjs/common';
import { catchError, Observable, of, switchMap } from 'rxjs';

import { SpaceService } from './space';
import { StackExchangeService } from './stack-exchante';

const welcomeMessage = 'Hey, thanks for having me installed :slightly_smiling_face:';

const noAnswerMessage = 'Unfortunately I didn\'t find an answer for you :face_with_rolling_eyes:';

@Controller('api')
export class AppController {
  constructor(
    private readonly space: SpaceService,
    private readonly stackExchange: StackExchangeService,
  ) {}

  @Post('space')
  dataFromSpace(@Body() body: any): Observable<any> {
    if (body['className'] === 'InitPayload') {
      const clientId = body['clientId'];
      const clientSecret = body['clientSecret'];
      const serverUrl = body['serverUrl'];
      const userId = body['userId'];

      const spaceClient = { clientId, clientSecret, serverUrl };
      return this.space.storeClient(spaceClient).pipe(
        switchMap(() => this.space.authenticate(spaceClient)),
        switchMap(session => this.space.sendMessageToUser(session, userId, welcomeMessage)),
      );
    } else if (body['className'] === 'MessagePayload') {
      const clientId: string = body['clientId'];
      const message: string = body['message'];
      const channelId: string = message['channelId'];
      const messageText: string = message['body']['text'];

      return this.space.authenticate(clientId).pipe(
        switchMap(session => {
          const siteSlug = (messageText.match(/(?:^|\W)site:(\w+)(?:\W|$)/) || [])[1] || 'stackoverflow';
          const question = messageText.replace(/(?:^|\W)site:(\w+)(?:\W|$)/g, ' ');

          return this.stackExchange.searchAnswer(question, siteSlug).pipe(
            catchError(error => {
              console.error(error);
              return of(noAnswerMessage);
            }),
            switchMap(answer => this.space.sendMessageToChannel(session, channelId, answer)),
          );
        })
      );
    }
  }
}
