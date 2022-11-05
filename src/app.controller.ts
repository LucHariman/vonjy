import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { catchError, concat, Observable, of, switchMap } from 'rxjs';

import { SpaceService } from './space';
import { StackExchangeService } from './stack-exchante';

interface Command {
  name: string;
  param?: string;
}

const welcomeMessage = `Hey, thanks for having me installed :slightly_smiling_face:. How can I help you?

Or type \`/help\` for more information.`;

const noAnswerMessage = 'Unfortunately I didn\'t find an answer for you :face_with_rolling_eyes:';

@Controller('api')
export class AppController {
  constructor(
    private readonly space: SpaceService,
    private readonly stackExchange: StackExchangeService,
  ) {}

  @Post('space')
  @HttpCode(HttpStatus.OK)
  dataFromSpace(@Body() body: any): any | Observable<any> {
    // TODO: Verify Space request
    if (body['className'] === 'InitPayload') {
      const clientId = body['clientId'];
      const clientSecret = body['clientSecret'];
      const serverUrl = body['serverUrl'];
      const userId = body['userId'];

      const spaceClient = { clientId, clientSecret, serverUrl };
      return this.space.storeClient(spaceClient).pipe(
        switchMap(() => this.space.authenticate(spaceClient)),
        switchMap(session =>
          concat(
            this.space.setChatBotUIExtension(session),
            this.space.sendMessageToUser(session, userId, welcomeMessage),
          ),
        ),
      );
    } else if (body['className'] === 'MessagePayload') {
      const clientId: string = body['clientId'];
      const message: string = body['message'];
      const channelId: string = message['channelId'];
      const messageText: string = message['body']['text'];

      return this.space.authenticate(clientId).pipe(
        switchMap(session => {
          const command = this.parseCommand(messageText, 'stackoverflow');

          let action: Observable<string>;
          if (command.name === 'help') {
            action = of(this.generateHelpPessage());
          } else {
            const { name: siteSlug, param: question } = command;
            action = this.stackExchange.searchAnswer(question, siteSlug).pipe(
              catchError(error => {
                console.error(error);
                return of(noAnswerMessage);
              })
            );
          }
          return action.pipe(switchMap(answer => this.space.sendMessageToChannel(session, channelId, answer)));
        })
      );
    } else if (body['className'] === 'ListCommandsPayload') {
      return this.generateCommands();
    }
  }

  private parseCommand(message: string, defaultCommandName: string): Command {
    const match = message.match(/^(\S+)(?:(?:\s+)(.*))?$/);
    if (match) {
      const [, name, param] = match;
      const { commands } = this.generateCommands();
      if (commands.some(command => command.name === name)) {
        return { name, param };
      }
    }
    return { name: defaultCommandName, param: message };
  }

  private generateHelpPessage() {
    return `I can help you to find the best Stack Exchange answer for the question that matches your search term.

## Available commands
- \`help\`: shows this usage instruction
- \`[site-name] [search-term]\`: searches for answer in the indicated site,
for eg. \`stackoverflow regular expression for date\`

When a search term is typed without starting with a site name, \`stackoverflow\` is applied by default.

## Available sites
${this.stackExchange.sites.map(site => `- \`${site.slug}\`: ${site.name} - ${site.audience}`).join('\n')}
`;
  }

  private generateCommands() {
    return {
      commands: [
        { name: 'help', description: 'Show usage instruction' },
        ...this.stackExchange.sites.map(site => ({
          name: site.slug, description: `Search on ${site.name}`
        }))
      ],
    };
  }
}
