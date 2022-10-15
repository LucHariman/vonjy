import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { SpaceService } from './space';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [SpaceService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });
});
