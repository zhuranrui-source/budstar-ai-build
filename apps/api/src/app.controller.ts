import { Controller, Get, Inject } from '@nestjs/common';
import type { AuthenticationAdapters } from './auth/authentication-boundaries';
import { AUTHENTICATION_ADAPTERS } from './auth/authentication.tokens';
import { Public } from './authorization/authorization.decorators';

@Controller()
export class AppController {
  constructor(
    @Inject(AUTHENTICATION_ADAPTERS)
    private readonly authenticationAdapters: AuthenticationAdapters,
  ) {}

  @Get('health')
  @Public()
  health(): {
    status: 'ok';
    readiness?: 'ready' | 'degraded';
    degradedReasons?: string[];
  } {
    const readiness = this.authenticationAdapters.readiness?.();
    return readiness && !readiness.ready
      ? {
          status: 'ok',
          readiness: 'degraded',
          degradedReasons: readiness.degradedReasons,
        }
      : { status: 'ok' };
  }
}
