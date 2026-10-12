import { Test, TestingModule } from '@nestjs/testing';
import { AUTHENTICATION_ADAPTERS } from './auth/authentication.tokens';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AUTHENTICATION_ADAPTERS,
          useValue: {
            readiness: () => ({ ready: true, degradedReasons: [] }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports health without internal details', () => {
      expect(appController.health()).toEqual({ status: 'ok' });
    });
  });
});
