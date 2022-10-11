import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('space')
  async dataFromSpace(@Body() body: any): Promise<any> {
    if (body['className'] === 'InitPayload') {
      const clientId = body['clientId'];
      const clientSecret = body['clientSecret'];
      const serverUrl = body['serverUrl'];
      await this.appService.storeClientDetails(clientId, { clientSecret, serverUrl });
    }
  }
}
