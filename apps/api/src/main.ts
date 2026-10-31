import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import express = require('express');
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.use('/vehicle-images', express.static(join(process.cwd(), 'public', 'vehicle-images'), { maxAge: '7d', immutable: true }));

  // WEB_ORIGIN supports a comma-separated allowlist. Normalize whitespace and
  // trailing slashes so a dashboard value cannot accidentally mismatch Origin.
  const configuredOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    'http://localhost:3000',
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Requests without an Origin header (for example, server-to-server calls)
      // are not browser CORS requests and should continue normally.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(
    Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
    '0.0.0.0',
  );
}
bootstrap();
