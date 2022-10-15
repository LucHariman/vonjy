import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { SpaceService } from './space';
import { StackExchangeService } from './stack-exchante';

@Module({
  imports: [ConfigModule.forRoot(), HttpModule],
  controllers: [AppController],
  providers: [SpaceService, StackExchangeService],
})
export class AppModule {}
