import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<any> {
    // TODO: Remove this sample code
    const clientId = '9f71a9da-4991-11ed-b878-0242ac120002';
    const details = await this.appService.queryClientDetails(clientId);
    return JSON.stringify(details);
  }
}
