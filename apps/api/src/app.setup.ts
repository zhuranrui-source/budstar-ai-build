import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { ApiException } from './http/api-error';
import { ApiExceptionFilter } from './http/api-exception.filter';

export function configureApp(app: INestApplication) {
  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3002'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    process.env.NODE_ENV === 'production' &&
    allowedOrigins.some((origin) => origin === '*')
  ) {
    throw new Error(
      'CORS_ORIGINS must not contain wildcard origins in production',
    );
  }

  const bodyLimit = process.env.REQUEST_BODY_LIMIT ?? '32kb';
  const trustProxyHops = resolveTrustProxyHops(process.env);
  const expressApp = app.getHttpAdapter().getInstance() as {
    set(setting: string, value: number): void;
  };
  expressApp.set('trust proxy', trustProxyHops);
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: false, limit: bodyLimit }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.header('x-request-id')?.trim();
    const requestId =
      incoming && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    response.setHeader('x-request-id', requestId);
    (request as Request & { requestId?: string }).requestId = requestId;
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Campus-Id',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new ApiException(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_ERROR',
          '请求参数不合法',
          errors.map((error) => ({
            field: error.property,
            constraints: Object.keys(error.constraints ?? {}),
          })),
        ),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}

export function resolveTrustProxyHops(
  environment: Record<string, string | undefined>,
  nodeEnv = environment.NODE_ENV,
): number {
  const rawValue = environment.TRUST_PROXY_HOPS;
  if (rawValue === undefined) {
    return 0;
  }

  const hops = Number(rawValue);
  if (!Number.isSafeInteger(hops) || hops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  if (nodeEnv === 'production' && hops > 1) {
    throw new Error('TRUST_PROXY_HOPS must be at most 1 in production');
  }

  return hops;
}
