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

  // Allow the deployed RoadNest frontend explicitly. WEB_ORIGIN can additionally
  // contain comma-separated custom frontend origins.
  const configuredOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    'https://roadnest-web.onrender.com',
    'http://localhost:3000',
    ...configuredOrigins,
  ]);
  console.log('[CORS] Allowed origins:', [...allowedOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      // Requests without an Origin header are not browser CORS requests.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      console.warn('[CORS] Rejected origin:', origin);
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
