import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { type Request, type Response } from 'express';
import { AppModule } from './app.module';

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

  // Initialise NestJS (registers all controller routes into Express) before we
  // add the raw Express catch-all. listen() calls init() internally, but only
  // AFTER we've already attached our catch-all — so we call init() explicitly
  // here first to guarantee NestJS routes are in the stack first.
  await app.init();

  // Serve built React web panel static assets (JS/CSS/images) from apps/bot/public/
  const publicDir = join(__dirname, '..', 'public');
  app.useStaticAssets(publicDir);

  // SPA catch-all: serve index.html for any route that isn't /api/** or a static file.
  // Registered directly on the Express instance AFTER app.init() so NestJS routes
  // take priority and this handler is only reached for unknown paths.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(/.*/, (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.sendFile(join(publicDir, 'index.html'), (err) => {
      if (err) res.status(500).json({ message: 'Internal error' });
    });
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
