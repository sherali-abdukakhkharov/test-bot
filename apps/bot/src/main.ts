import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { SpaExceptionFilter } from './spa-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS — allow web panel dev server and production domain
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Global prefix for all REST API routes
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Serve built React web panel static assets (JS/CSS/images).
  // __dirname resolves to .../apps/bot/dist/apps/bot/src/ at runtime (due to
  // TypeScript rootDir expansion from the @arab-tili/shared-types alias).
  // Four levels up reaches apps/bot/ where public/ lives.
  const publicDir = join(__dirname, '..', '..', '..', '..', 'public');
  app.useStaticAssets(publicDir);

  // SPA exception filter: serves index.html for any NotFoundException that
  // isn't under /api/, enabling React Router client-side navigation.
  app.useGlobalFilters(new SpaExceptionFilter());

  // Swagger (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Arab Tili Bot API')
      .setDescription('REST API for the Arab Tili Yordamchi web admin panel')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
